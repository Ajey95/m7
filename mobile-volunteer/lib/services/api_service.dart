import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// API Service for volunteer app - communicating with unified backend
class ApiService {
  // Using LAN IP for physical device testing
  // static const String baseUrl = 'http://localhost:8000/api/v1'; // Emulator only
  // Use the machine's current LAN IP so physical devices can reach the backend.
  static const String baseUrl =
      'http://10.214.97.83:8000/api/v1'; // Physical Device LAN IP (updated)

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
    String? city,
    String? vehicleType,
    String? aadhaarNumber,
  }) async {
    final data = {
      'email': email,
      'full_name': fullName,
      'phone_number': phoneNumber,
      'role': role.toUpperCase(), // Backend expects uppercase: VOLUNTEER
      'clerk_user_id':
          'mobile_${email.replaceAll('@', '_').replaceAll('.', '_')}', // Generate simple ID for test mode
    };
    if (city != null) data['city'] = city;
    if (vehicleType != null) data['vehicle_type'] = vehicleType;
    if (aadhaarNumber != null) data['aadhaar_number'] = aadhaarNumber;

    final response = await _dio.post('/auth/register', data: data);
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

  // ==================== VOLUNTEER ENDPOINTS ====================

  /// Get volunteer profile
  Future<Map<String, dynamic>> getVolunteerProfile() async {
    final response = await _dio.get('/volunteers/me');
    return response.data;
  }

  /// Create volunteer profile
  Future<Map<String, dynamic>> createVolunteerProfile({
    required String vehicleType,
    required bool hasCooling,
    required double capacityKg,
  }) async {
    final response = await _dio.post('/volunteers', data: {
      'vehicle_type': vehicleType,
      'has_cooling': hasCooling,
      'capacity_kg': capacityKg,
    });
    return response.data;
  }

  /// Go online
  Future<Map<String, dynamic>> goOnline(double lat, double lng) async {
    final response = await _dio.post('/volunteers/go-online', queryParameters: {
      'latitude': lat,
      'longitude': lng,
    });
    return response.data;
  }

  /// Go offline
  Future<Map<String, dynamic>> goOffline() async {
    try {
      final response = await _dio.post('/volunteers/go-offline');
      return response.data;
    } catch (e) {
      // If unauthorized (401), we might already be logged out or token expired
      // Just return empty success to allow local logout to proceed
      return {'status': 'success', 'message': 'Forced offline locally'};
    }
  }

  /// Update location
  Future<Map<String, dynamic>> updateLocation(double lat, double lng) async {
    final response = await _dio.patch('/volunteers/location', data: {
      'latitude': lat,
      'longitude': lng,
    });
    return response.data;
  }

  /// Get current task
  Future<Map<String, dynamic>?> getCurrentTask() async {
    try {
      final response = await _dio.get('/volunteers/current-task');
      return response.data;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  /// Accept task
  Future<Map<String, dynamic>> acceptTask(String taskId) async {
    final response = await _dio.post('/tasks/$taskId/accept');
    return response.data;
  }

  /// Verify pickup with QR token
  Future<Map<String, dynamic>> verifyPickup(
      String taskId, String qrToken) async {
    final response = await _dio.post('/tasks/$taskId/pickup-verify', data: {
      'token':
          qrToken, // Backend expects 'token', not 'qr_token' in QRVerifyRequest
    });
    return response.data;
  }

  /// Verify delivery with QR token
  Future<Map<String, dynamic>> verifyDelivery(
      String taskId, String qrToken) async {
    final response = await _dio.post('/tasks/$taskId/delivery-verify', data: {
      'token': qrToken, // Backend expects 'token', not 'qr_token'
    });
    return response.data;
  }

  /// Get task history
  Future<List<dynamic>> getTaskHistory() async {
    final response = await _dio.get('/volunteers/task-history');
    return response.data;
  }
}
