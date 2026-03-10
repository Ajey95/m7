import 'package:flutter/foundation.dart'; // For kIsWeb
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geocoding/geocoding.dart';
import 'package:file_picker/file_picker.dart';
import '../../main.dart';
import '../../services/location_service.dart';

/// NGO Registration Screen — 2-Step Process
/// Step 1: Basic Info (org name, email, phone, address+GPS, password)
/// Step 2: License Verification (license type, number, expiry, document upload)
/// Mirrors the frontend's registration flow
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  int _currentStep = 0; // 0 = Basic Info, 1 = License Verification
  bool _isLoading = false;
  String? _errorMessage;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  // Step 1: Basic Info
  final _orgNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  double? _latitude;
  double? _longitude;
  bool _isDetectingLocation = false;

  // Step 2: License Verification
  String _selectedLicenseType = 'DARPAN';
  final _licenseNumberController = TextEditingController();
  DateTime? _licenseExpiry;
  String? _uploadedFilePath;
  String? _uploadedFileName;
  Uint8List? _uploadedFileBytes;
  bool _isUploadingFile = false;

  final LocationService _locationService = LocationService();

  final List<Map<String, String>> _licenseTypes = [
    {'value': 'DARPAN', 'label': 'NGO Darpan (NITI Aayog)'},
    {'value': 'FCRA', 'label': 'FCRA Registration'},
    {'value': 'TRUST', 'label': 'Trust Registration'},
    {'value': 'SOCIETY', 'label': 'Society Registration'},
    {'value': 'SECTION_8', 'label': 'Section 8 Company'},
    {'value': 'OTHER', 'label': 'Other Registration'},
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _prefillData());
  }

  Future<void> _prefillData() async {
    final apiService = ref.read(apiServiceProvider);
    if (apiService.isAuthenticated) {
      setState(() => _isLoading = true);
      try {
        final ngo = await apiService.getNgoProfile();
        setState(() {
          _orgNameController.text = ngo['organization_name'] ?? '';
          _addressController.text = ngo['address'] ?? '';
          _latitude = ngo['latitude'];
          _longitude = ngo['longitude'];
          _emailController.text = ngo['email'] ?? '';
          _phoneController.text = ngo['phone'] ?? '';
          
          String license = ngo['license_number'] ?? '';
          if (license.contains('-')) {
            final parts = license.split('-');
            if (_licenseTypes.any((t) => t['value'] == parts[0])) {
              _selectedLicenseType = parts[0];
              _licenseNumberController.text = parts.sublist(1).join('-');
            } else {
              _licenseNumberController.text = license;
            }
          } else {
            _licenseNumberController.text = license;
          }
          
          if (ngo['license_expiry'] != null) {
            _licenseExpiry = DateTime.parse(ngo['license_expiry']);
          }
        });
      } catch (e) {
        debugPrint('Pre-fill error: $e');
      } finally {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  void dispose() {
    _orgNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _licenseNumberController.dispose();
    super.dispose();
  }

  /// Detect location using GPS
  Future<void> _detectLocation() async {
    setState(() => _isDetectingLocation = true);

    try {
      final position = await _locationService.getCurrentPosition();
      if (position != null) {
        _latitude = position.latitude;
        _longitude = position.longitude;

        // Reverse geocode to get address (Geocoding doesn't work on Web)
        if (!kIsWeb) {
          try {
            final placemarks = await placemarkFromCoordinates(
              position.latitude,
              position.longitude,
            );
            if (placemarks.isNotEmpty) {
              final place = placemarks.first;
              final parts = [
                place.street,
                place.locality,
                place.administrativeArea,
                place.postalCode,
                place.country,
              ].where((p) => p != null && p.isNotEmpty).toList();
              _addressController.text = parts.join(', ');
            }
          } catch (e) {
            _addressController.text =
                '${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}';
          }
        } else {
          _addressController.text =
                '${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}';
        }

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('📍 Location detected successfully!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Failed to get location. Check GPS permissions.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Location error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }

    setState(() => _isDetectingLocation = false);
  }

  /// Pick license document file
  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
        withData: true, // Needed for Web to get bytes
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        setState(() {
          _uploadedFileName = file.name;
          _uploadedFileBytes = file.bytes; // Always available (withData: true)
          _uploadedFilePath = kIsWeb ? null : file.path; // Path unavailable on web
        });
      }
    } catch (e) {
      // Ignore minor errors (e.g. user cancelled)
    }
  }

  /// Upload the license file to backend
  Future<String?> _uploadLicenseFile() async {
    if (_uploadedFilePath == null && _uploadedFileBytes == null) return null;

    setState(() => _isUploadingFile = true);
    try {
      final apiService = ref.read(apiServiceProvider);
      final result = await apiService.uploadLicenseFile(
        filePath: _uploadedFilePath,
        fileBytes: _uploadedFileBytes,
        fileName: _uploadedFileName,
      );
      setState(() => _isUploadingFile = false);
      return result['url'] ?? result['file_url'];
    } catch (e) {
      setState(() => _isUploadingFile = false);
      return null;
    }
  }

  /// Password strength calculation
  double _getPasswordStrength(String password) {
    if (password.isEmpty) return 0;
    double strength = 0;
    if (password.length >= 6) strength += 0.2;
    if (password.length >= 8) strength += 0.1;
    if (password.length >= 12) strength += 0.1;
    if (password.contains(RegExp(r'[A-Z]'))) strength += 0.15;
    if (password.contains(RegExp(r'[a-z]'))) strength += 0.15;
    if (password.contains(RegExp(r'[0-9]'))) strength += 0.15;
    if (password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))) strength += 0.15;
    return strength.clamp(0.0, 1.0);
  }

  String _getPasswordStrengthLabel(double strength) {
    if (strength <= 0.25) return 'Weak';
    if (strength <= 0.5) return 'Fair';
    if (strength <= 0.75) return 'Good';
    return 'Strong';
  }

  Color _getPasswordStrengthColor(double strength) {
    if (strength <= 0.25) return Colors.red;
    if (strength <= 0.5) return Colors.orange;
    if (strength <= 0.75) return Colors.blue;
    return Colors.green;
  }

  /// Validate Step 1 and move to Step 2
  void _nextStep() {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _currentStep = 1;
      _errorMessage = null;
    });
  }

  /// Go back to Step 1
  void _previousStep() {
    setState(() {
      _currentStep = 0;
      _errorMessage = null;
    });
  }

  /// Submit registration (Step 1 data + Step 2 license data)
  Future<void> _submitRegistration() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apiService = ref.read(apiServiceProvider);
      final bool isUpdate = apiService.isAuthenticated;

      if (!isUpdate) {
        // Step 1: Register user account
        await apiService.register(
          email: _emailController.text.trim(),
          fullName: _orgNameController.text.trim(),
          phoneNumber: _phoneController.text.trim(),
          address: _addressController.text.trim(),
          latitude: _latitude,
          longitude: _longitude,
          password: _passwordController.text,
        );

        // Login to get token for license submission
        await apiService.login(
          _emailController.text.trim(),
          _passwordController.text,
        );
      }

      // Step 2: Update NGO profile (since /register already created a placeholder)
      await apiService.updateNgoProfile(
        organizationName: _orgNameController.text.trim(),
        licenseNumber: _licenseNumberController.text.trim(),
        address: _addressController.text.trim(),
        latitude: _latitude,
        longitude: _longitude,
      );

      // Step 2: Upload license file if selected (check bytes for web support)
      String? fileUrl;
      if (_uploadedFilePath != null || _uploadedFileBytes != null) {
        fileUrl = await _uploadLicenseFile();
      }

      // Submit license details
      if (_licenseNumberController.text.isNotEmpty) {
        await apiService.submitNgoLicense(
          licenseNumber: '$_selectedLicenseType-${_licenseNumberController.text.trim()}',
          licenseExpiry: _licenseExpiry?.toIso8601String() ?? '',
          licenseDocumentUrl: fileUrl,
        );
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        // Show success dialog then navigate
        await showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFB923C),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check, color: Colors.white, size: 36),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Registration Submitted!',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Your NGO account has been created and is pending admin verification. You will receive full access once approved.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey[600], height: 1.4),
                ),
              ],
            ),
            actions: [
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context); // Close dialog
                    Navigator.pushReplacementNamed(context, '/ngo-home');
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFB923C),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Continue to Dashboard'),
                ),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        String message = e.toString();
        if (e is dynamic && e.toString().contains('DioException')) {
          try {
            // Attempt to extract the "detail" from the server response
            final responseData = (e as dynamic).response?.data;
            if (responseData is Map && responseData.containsKey('detail')) {
              message = responseData['detail'];
            } else {
              message = 'Connection error. Please check if backend is running.';
            }
          } catch (_) {
            message = 'Registration failed. Please try again.';
          }
        }
        
        setState(() {
          _isLoading = false;
          _errorMessage = message;
        });
      }
    }
  }

  /// Pick expiry date
  Future<void> _pickExpiryDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 365)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
      builder: (context, child) {
        return Theme(
          data: ThemeData.light().copyWith(
            colorScheme: const ColorScheme.light(primary: Color(0xFFFB923C)),
          ),
          child: child!,
        );
      },
    );

    if (date != null) {
      setState(() => _licenseExpiry = date);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1F2937)),
          onPressed: () {
            if (_currentStep == 1) {
              _previousStep();
            } else {
              Navigator.pop(context);
            }
          },
        ),
        title: Text(
          _currentStep == 0 ? 'Register NGO' : 'License Verification',
          style: const TextStyle(color: Color(0xFF1F2937), fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Step indicator
            _buildStepIndicator(),

            // Form content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Form(
                  key: _formKey,
                  child: _currentStep == 0 ? _buildStep1() : _buildStep2(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: [
          _buildStepCircle(0, 'Basic Info', Icons.person_outline),
          Expanded(
            child: Container(
              height: 2,
              color: _currentStep >= 1 ? const Color(0xFFFB923C) : Colors.grey[300],
            ),
          ),
          _buildStepCircle(1, 'License', Icons.verified_user_outlined),
        ],
      ),
    );
  }

  Widget _buildStepCircle(int step, String label, IconData icon) {
    final isActive = _currentStep >= step;
    final isCurrent = _currentStep == step;

    return Column(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isActive ? const Color(0xFFFB923C) : Colors.grey[200],
            border: isCurrent
                ? Border.all(color: const Color(0xFFFB923C), width: 2)
                : null,
            boxShadow: isCurrent
                ? [
                    BoxShadow(
                      color: const Color(0xFFFB923C).withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Icon(
            icon,
            color: isActive ? Colors.white : Colors.grey,
            size: 22,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
            color: isActive ? const Color(0xFFFB923C) : Colors.grey,
          ),
        ),
      ],
    );
  }

  /// Step 1: Basic Information
  Widget _buildStep1() {
    final passwordStrength = _getPasswordStrength(_passwordController.text);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_errorMessage != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Organization Name
        TextFormField(
          controller: _orgNameController,
          decoration: InputDecoration(
            labelText: 'Organization Name *',
            hintText: 'e.g. Food For All Foundation',
            prefixIcon: const Icon(Icons.business),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            filled: true,
            fillColor: Colors.grey[50],
          ),
          validator: (v) => (v == null || v.isEmpty) ? 'Organization name is required' : null,
        ),
        const SizedBox(height: 16),

        // Email
        TextFormField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: InputDecoration(
            labelText: 'Email Address *',
            hintText: 'ngo@example.com',
            prefixIcon: const Icon(Icons.email_outlined),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            filled: true,
            fillColor: Colors.grey[50],
          ),
          validator: (v) {
            if (v == null || v.isEmpty) return 'Email is required';
            if (!v.contains('@')) return 'Enter a valid email';
            return null;
          },
        ),
        const SizedBox(height: 16),

        // Phone
        TextFormField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: 'Phone Number *',
            hintText: '+91 9876543210',
            prefixIcon: const Icon(Icons.phone_outlined),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            filled: true,
            fillColor: Colors.grey[50],
          ),
          validator: (v) => (v == null || v.isEmpty) ? 'Phone number is required' : null,
        ),
        const SizedBox(height: 16),

        // Address with GPS detection
        TextFormField(
          controller: _addressController,
          maxLines: 2,
          decoration: InputDecoration(
            labelText: 'Address *',
            hintText: 'Organization address',
            prefixIcon: const Padding(
              padding: EdgeInsets.only(bottom: 24),
              child: Icon(Icons.location_on_outlined),
            ),
            suffixIcon: _isDetectingLocation
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : IconButton(
                    icon: const Icon(Icons.gps_fixed, color: Color(0xFFFB923C)),
                    onPressed: _detectLocation,
                    tooltip: 'Detect using GPS',
                  ),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            filled: true,
            fillColor: Colors.grey[50],
          ),
          validator: (v) => (v == null || v.isEmpty) ? 'Address is required' : null,
        ),
        if (_latitude != null && _longitude != null)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 8),
            child: Text(
              '📍 GPS: ${_latitude!.toStringAsFixed(4)}, ${_longitude!.toStringAsFixed(4)}',
              style: TextStyle(fontSize: 12, color: Colors.green[700]),
            ),
          ),
        const SizedBox(height: 16),

        // Password Section (only for new registration)
        if (!ref.read(apiServiceProvider).isAuthenticated) ...[
          // Password
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Password *',
              prefixIcon: const Icon(Icons.lock_outlined),
              suffixIcon: IconButton(
                icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.grey[50],
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Password is required';
              if (v.length < 6) return 'Password must be at least 6 characters';
              return null;
            },
          ),

          // Password strength indicator
          if (_passwordController.text.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: passwordStrength,
                      minHeight: 6,
                      backgroundColor: Colors.grey[200],
                      valueColor: AlwaysStoppedAnimation(_getPasswordStrengthColor(passwordStrength)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  _getPasswordStrengthLabel(passwordStrength),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: _getPasswordStrengthColor(passwordStrength),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),

          // Confirm Password
          TextFormField(
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            decoration: InputDecoration(
              labelText: 'Confirm Password *',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(_obscureConfirmPassword ? Icons.visibility_off : Icons.visibility),
                onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
              ),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.grey[50],
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Please confirm your password';
              if (v != _passwordController.text) return 'Passwords do not match';
              return null;
            },
          ),
        ],
        const SizedBox(height: 32),

        // Next button
        SizedBox(
          height: 52,
          child: ElevatedButton.icon(
            onPressed: _nextStep,
            icon: const Icon(Icons.arrow_forward),
            label: const Text('Next: License Verification', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFB923C),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 2,
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Already have account?
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text("Already have an account? ", style: TextStyle(color: Colors.grey[600])),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Sign In', style: TextStyle(color: Color(0xFFFB923C), fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ],
    );
  }

  /// Step 2: License Verification
  Widget _buildStep2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Info banner
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFFB923C).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFB923C).withOpacity(0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline, color: Color(0xFFFB923C), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Provide your NGO registration details for admin verification. This helps establish trust.',
                  style: TextStyle(color: Colors.orange.shade900, fontSize: 13),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        if (_errorMessage != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // License Type Dropdown
        DropdownButtonFormField<String>(
          value: _selectedLicenseType,
          decoration: InputDecoration(
            labelText: 'Registration Type *',
            prefixIcon: const Icon(Icons.category_outlined),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            filled: true,
            fillColor: Colors.grey[50],
          ),
          items: _licenseTypes.map((type) {
            return DropdownMenuItem(
              value: type['value'],
              child: Text(type['label']!),
            );
          }).toList(),
          onChanged: (value) {
            if (value != null) setState(() => _selectedLicenseType = value);
          },
        ),
        const SizedBox(height: 16),

        // License Number
        Padding(
          padding: const EdgeInsets.only(bottom: 16.0),
          child: TextFormField(
            controller: _licenseNumberController,
            decoration: InputDecoration(
              labelText: 'Registration / License Number *',
              hintText: 'e.g. DL/2024/1234567',
              prefixIcon: const Icon(Icons.numbers_outlined),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.grey[50],
            ),
            validator: (v) => (v == null || v.isEmpty) ? 'License number is required' : null,
          ),
        ),

        // Expiry Date
        InkWell(
          onTap: _pickExpiryDate,
          child: InputDecorator(
            decoration: InputDecoration(
              labelText: 'License Expiry Date',
              prefixIcon: const Icon(Icons.calendar_today_outlined),
              suffixIcon: const Icon(Icons.arrow_drop_down),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.grey[50],
            ),
            child: Text(
              _licenseExpiry != null
                  ? '${_licenseExpiry!.day}/${_licenseExpiry!.month}/${_licenseExpiry!.year}'
                  : 'Select expiry date (optional)',
              style: TextStyle(
                color: _licenseExpiry != null ? Colors.black : Colors.grey[600],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),

        // File Upload
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[300]!, style: BorderStyle.solid),
            borderRadius: BorderRadius.circular(12),
            color: Colors.grey[50],
          ),
          child: Column(
            children: [
              if (_uploadedFileName != null) ...[
                Row(
                  children: [
                    const Icon(Icons.attach_file, color: Color(0xFFFB923C)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _uploadedFileName!,
                        style: const TextStyle(fontWeight: FontWeight.w500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () => setState(() {
                        _uploadedFilePath = null;
                        _uploadedFileName = null;
                      }),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
              OutlinedButton.icon(
                onPressed: _pickFile,
                icon: Icon(
                  _uploadedFileName != null ? Icons.swap_horiz : Icons.upload_file,
                  color: const Color(0xFFFB923C),
                ),
                label: Text(
                  _uploadedFileName != null ? 'Change File' : 'Upload License Document',
                  style: const TextStyle(color: Color(0xFFFB923C)),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFFB923C)),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Accepted: PDF, JPG, PNG (max 10MB)',
                style: TextStyle(fontSize: 11, color: Colors.grey[500]),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // Submit button
        SizedBox(
          height: 52,
          child: ElevatedButton.icon(
            onPressed: (_isLoading || _isUploadingFile) ? null : _submitRegistration,
            icon: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.check_circle_outline),
            label: Text(
              _isLoading ? 'Registering...' : 'Submit Registration',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFB923C),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 2,
            ),
          ),
        ),
        const SizedBox(height: 12),

        // Back button
        TextButton.icon(
          onPressed: _previousStep,
          icon: const Icon(Icons.arrow_back),
          label: const Text('Back to Basic Info'),
          style: TextButton.styleFrom(foregroundColor: Colors.grey[700]),
        ),
      ],
    );
  }
}
