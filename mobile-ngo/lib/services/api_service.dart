import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// API Service for communicating with unified backend
/// NGO-specific endpoints only
class ApiService {
  // switch URLs based on target:
  static const String baseUrl = 'http://localhost:8000/api/v1'; // Chrome / Desktop
  // static const String baseUrl = 'http://10.50.137.163:8000/api/v1'; // Physical Device LAN IP
  
  late final Dio _dio;
  String? _authToken;

  ApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (_authToken != null) {
          options.headers['Authorization'] = 'Bearer $_authToken';
        }
        return handler.next(options);
      },
      onError: (error, handler) {
        // Handle 401 Unauthorized
        if (error.response?.statusCode == 401) {
          clearToken();
        }
        // Handle 403 Forbidden - Log details
        if (error.response?.statusCode == 403) {
          print('403 Forbidden: ${error.response?.data}');
        }
        return handler.next(error);
      },
    ));
  }

  /// Set auth token
  Future<void> setToken(String token) async {
    _authToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', token);
  }

  /// Load token from storage
  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _authToken = prefs.getString('auth_token');
  }

  /// Clear token on logout
  Future<void> clearToken() async {
    _authToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }

  bool get isAuthenticated => _authToken != null;

  // ==================== AUTH ENDPOINTS ====================

  /// Register new NGO user
  Future<Map<String, dynamic>> register({
    required String email,
    required String fullName,
    required String phoneNumber,
    String? address,
    double? latitude,
    double? longitude,
    required String password,
  }) async {
    final response = await _dio.post('/auth/register', data: {
      'email': email,
      'full_name': fullName,
      'phone_number': phoneNumber,
      'role': 'NGO',
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'password': password,
      'clerk_user_id': 'mobile_ngo_${email.replaceAll('@', '_').replaceAll('.', '_')}',
    });
    return response.data;
  }

  /// Login (test mode)
  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _dio.post('/auth/login',
        data: {'username': email, 'password': password},
        options: Options(contentType: Headers.formUrlEncodedContentType));
    
    if (response.data['access_token'] != null) {
      await setToken(response.data['access_token']);
    }
    return response.data;
  }

  /// Get current user profile
  Future<Map<String, dynamic>> getCurrentUser() async {
    final response = await _dio.get('/auth/me');
    return response.data;
  }

  // ==================== NGO ENDPOINTS ====================

  /// Get NGO profile
  Future<Map<String, dynamic>> getNgoProfile() async {
    final response = await _dio.get('/ngos/me');
    return response.data;
  }

  /// Create NGO profile
  Future<Map<String, dynamic>> createNgoProfile({
    required String organizationName,
    required String licenseNumber,
    required String address,
    required double latitude,
    required double longitude,
    int capacityKg = 100,
  }) async {
    final response = await _dio.post('/ngos', data: {
      'organization_name': organizationName,
      'license_number': licenseNumber,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'capacity_kg': capacityKg,
    });
    return response.data;
  }

  /// Update NGO profile
  Future<Map<String, dynamic>> updateNgoProfile({
    String? organizationName,
    String? licenseNumber,
    String? address,
    double? latitude,
    double? longitude,
    int? capacityKg,
  }) async {
    final Map<String, dynamic> data = {};
    if (organizationName != null) data['organization_name'] = organizationName;
    if (licenseNumber != null) data['license_number'] = licenseNumber;
    if (address != null) data['address'] = address;
    if (latitude != null) data['latitude'] = latitude;
    if (longitude != null) data['longitude'] = longitude;
    if (capacityKg != null) data['capacity_kg'] = capacityKg;

    final response = await _dio.patch('/ngos/me', data: data);
    return response.data;
  }

  /// Get nearby tasks for NGO
  Future<List<dynamic>> getNgoNearbyTasks() async {
    final response = await _dio.get('/ngos/nearby-tasks');
    return response.data;
  }

  /// Claim a task
  Future<Map<String, dynamic>> claimTask(String taskId) async {
    final response = await _dio.post('/ngos/tasks/$taskId/claim');
    return response.data;
  }

  /// Get claimed tasks
  Future<List<dynamic>> getNgoClaimedTasks() async {
    final response = await _dio.get('/ngos/claimed-tasks');
    return response.data;
  }
  
  /// Verify receipt of a task (complete it)
  Future<Map<String, dynamic>> verifyTaskReceipt(String taskId) async {
    final response = await _dio.post('/ngos/tasks/$taskId/verify');
    return response.data;
  }

  // ==================== LICENSE ENDPOINTS ====================

  /// Submit NGO license details for verification
  Future<Map<String, dynamic>> submitNgoLicense({
    required String licenseNumber,
    required String licenseExpiry,
    String? licenseDocumentUrl,
  }) async {
    final response = await _dio.post('/ngos/me/license', data: {
      'license_number': licenseNumber,
      'license_expiry': licenseExpiry,
      if (licenseDocumentUrl != null) 'license_document_url': licenseDocumentUrl,
    });
    return response.data;
  }

  /// Upload license document file
  Future<Map<String, dynamic>> uploadLicenseFile({
    String? filePath,
    Uint8List? fileBytes,
    String? fileName,
  }) async {
    MultipartFile file;
    if (fileBytes != null && fileName != null) {
      file = MultipartFile.fromBytes(fileBytes, filename: fileName);
    } else if (filePath != null) {
      file = await MultipartFile.fromFile(filePath);
    } else {
      throw Exception('Missing file data for upload');
    }

    final formData = FormData.fromMap({
      'file': file,
    });

    final response = await _dio.post(
      '/ngos/upload-license',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
    return response.data;
  }

  /// Get NGO verification status
  Future<Map<String, dynamic>> getNgoStatus() async {
    final response = await _dio.get('/ngos/me/status');
    return response.data;
  }
}
