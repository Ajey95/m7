import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// API Service for communicating with unified backend
class ApiService {
  // Using LAN IP for physical device testing
  // static const String baseUrl = 'http://localhost:8000/api/v1'; // Emulator only
  static const String baseUrl = 'http://10.186.157.145:8000/api/v1'; // Physical Device LAN IP
  
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
          // Token expired, redirect to login
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

  /// Register new user
  Future<Map<String, dynamic>> register({
    required String email,
    required String fullName,
    required String phoneNumber,
    required String role,
  }) async {
    final response = await _dio.post('/auth/register', data: {
      'email': email,
      'full_name': fullName,
      'phone_number': phoneNumber,
      'role': role.toUpperCase(), // Backend expects uppercase: DONOR, VOLUNTEER, NGO, ADMIN
      'clerk_user_id': 'mobile_${email.replaceAll('@', '_').replaceAll('.', '_')}', // Generate simple ID for test mode
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

  // ==================== DONOR ENDPOINTS ====================

  /// Get donor profile
  Future<Map<String, dynamic>> getDonorProfile() async {
    final response = await _dio.get('/donors/me');
    return response.data;
  }

  /// Create donor profile
  Future<Map<String, dynamic>> createDonorProfile({
    required String organizationName,
    required String address,
    required double latitude,
    required double longitude,
  }) async {
    final response = await _dio.post('/donors', data: {
      'organization_name': organizationName,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
    });
    return response.data;
  }

  /// Get donor's tasks
  Future<List<dynamic>> getDonorTasks() async {
    final response = await _dio.get('/donors/tasks');
    return response.data;
  }

  /// Update donor profile
  Future<Map<String, dynamic>> updateDonorProfile({
    String? organizationName,
    String? address,
    double? latitude,
    double? longitude,
  }) async {
    final Map<String, dynamic> data = {};
    if (organizationName != null) data['organization_name'] = organizationName;
    if (address != null) data['address'] = address;
    if (latitude != null) data['latitude'] = latitude;
    if (longitude != null) data['longitude'] = longitude;

    final response = await _dio.patch('/donors/me', data: data);
    return response.data;
  }


  /// Create donation task
  Future<Map<String, dynamic>> createDonation({
    required double pickupLat,
    required double pickupLng,
    double? dropLat,
    double? dropLng,
    required String foodType,
    required double quantityKg,
    String? description,
    bool requiresCooling = false,
    DateTime? expiryTime,
  }) async {
    final response = await _dio.post('/donors/tasks', data: {
      'pickup_lat': pickupLat,
      'pickup_lng': pickupLng,
      'drop_lat': dropLat,
      'drop_lng': dropLng,
      'food_type': foodType,
      'quantity_kg': quantityKg,
      'description': description,
      'requires_cooling': requiresCooling,
      'expiry_time': expiryTime?.toIso8601String(),
    });
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
}
