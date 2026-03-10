import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';
import '../../main.dart';

class RegisterStep2Screen extends ConsumerStatefulWidget {
  final Map<String, String> step1Data;

  const RegisterStep2Screen({super.key, required this.step1Data});

  @override
  ConsumerState<RegisterStep2Screen> createState() =>
      _RegisterStep2ScreenState();
}

class _RegisterStep2ScreenState extends ConsumerState<RegisterStep2Screen> {
  final ImagePicker _picker = ImagePicker();

  XFile? _drivingLicense;
  XFile? _vehicleRC;
  XFile? _passportPhoto;

  bool _isLoading = false;
  String? _errorMessage;

  bool get _isMotorVehicle {
    final vehicle = widget.step1Data['vehicle_type'] ?? '';
    return vehicle == 'Bike' || vehicle == 'Scooter';
  }

  Future<void> _pickImage(String docType) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Text(
                'Choose Photo Source',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.camera_alt, color: Color(0xFF4CAF50)),
                ),
                title: const Text('Camera'),
                subtitle: const Text('Take a new photo'),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2196F3).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child:
                      const Icon(Icons.photo_library, color: Color(0xFF2196F3)),
                ),
                title: const Text('Gallery'),
                subtitle: const Text('Choose from gallery'),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );

    if (source == null) return;

    final picked = await _picker.pickImage(source: source, imageQuality: 80);
    if (picked == null) return;

    setState(() {
      switch (docType) {
        case 'license':
          _drivingLicense = picked;
          break;
        case 'rc':
          _vehicleRC = picked;
          break;
        case 'photo':
          _passportPhoto = picked;
          break;
      }
    });
  }

  bool _validateDocuments() {
    if (_isMotorVehicle && _drivingLicense == null) {
      setState(() {
        _errorMessage =
            'Driving License is required for ${widget.step1Data['vehicle_type']}';
      });
      return false;
    }
    if (_vehicleRC == null) {
      setState(() => _errorMessage = 'Vehicle RC is required');
      return false;
    }
    if (_passportPhoto == null) {
      setState(() => _errorMessage = 'Passport-size photo is required');
      return false;
    }
    return true;
  }

  Future<void> _submitRegistration() async {
    if (!_validateDocuments()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apiService = ref.read(apiServiceProvider);
      final data = widget.step1Data;

      await apiService.register(
        email: data['email']!.isNotEmpty
            ? data['email']!
            : '${data['phone_number']!.replaceAll('+', '')}@volunteer.local',
        fullName: data['full_name']!,
        phoneNumber: data['phone_number']!,
        role: 'VOLUNTEER',
        city: data['city'],
        vehicleType: data['vehicle_type'],
        aadhaarNumber: data['aadhaar_number'],
      );

      if (!mounted) return;

      // After registering, attempt to log in (TEST_MODE allows token issuance without password)
      final usedEmail = data['email']!.isNotEmpty
          ? data['email']!
          : '${data['phone_number']!.replaceAll('+', '')}@volunteer.local';

      try {
        await apiService.login(usedEmail, 'password');
        if (!mounted) return;
        Navigator.pushReplacementNamed(context, '/waiting-approval');
      } catch (e) {
        // If login fails, fall back to login screen
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Registration successful! Please login.'),
            backgroundColor: Color(0xFF4CAF50),
          ),
        );
        if (!mounted) return;
        Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
      }
    } catch (e) {
      String errorMsg = 'Registration failed. Please try again.';
      if (e is DioException && e.response != null) {
        if (e.response?.data is Map && e.response?.data['detail'] != null) {
          errorMsg = e.response?.data['detail'];
        }
      }
      setState(() => _errorMessage = errorMsg);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Upload Documents'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Step indicator
              _buildStepIndicator(),
              const SizedBox(height: 28),

              const Text(
                'Document Submission',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Upload clear photos/scans of your documents',
                style: TextStyle(fontSize: 15, color: Colors.grey[600]),
              ),
              const SizedBox(height: 24),

              // Error message
              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline,
                          color: Colors.red.shade700, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(
                              color: Colors.red.shade700, fontSize: 14),
                        ),
                      ),
                    ],
                  ),
                ),

              // Driving License
              _buildDocumentTile(
                title: 'Driving License',
                subtitle: _isMotorVehicle
                    ? 'Mandatory for ${widget.step1Data['vehicle_type']}'
                    : 'Optional for Cycle',
                icon: Icons.card_membership,
                file: _drivingLicense,
                isRequired: _isMotorVehicle,
                onTap: () => _pickImage('license'),
                onClear: () => setState(() => _drivingLicense = null),
              ),
              const SizedBox(height: 16),

              // Vehicle RC
              _buildDocumentTile(
                title: 'Vehicle RC',
                subtitle: 'Registration Certificate',
                icon: Icons.description_outlined,
                file: _vehicleRC,
                isRequired: true,
                onTap: () => _pickImage('rc'),
                onClear: () => setState(() => _vehicleRC = null),
              ),
              const SizedBox(height: 16),

              // Passport Photo
              _buildDocumentTile(
                title: 'Passport-size Photo',
                subtitle: 'Clear front-facing photo',
                icon: Icons.account_circle_outlined,
                file: _passportPhoto,
                isRequired: true,
                onTap: () => _pickImage('photo'),
                onClear: () => setState(() => _passportPhoto = null),
              ),
              const SizedBox(height: 32),

              // Submit button
              ElevatedButton(
                onPressed: _isLoading ? null : _submitRegistration,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4CAF50),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  elevation: 2,
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Submit Registration',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDocumentTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required XFile? file,
    required bool isRequired,
    required VoidCallback onTap,
    required VoidCallback onClear,
  }) {
    final hasFile = file != null;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: hasFile
                ? const Color(0xFF4CAF50)
                : isRequired
                    ? Colors.grey[400]!
                    : Colors.grey[300]!,
            width: hasFile ? 2 : 1.5,
            style: hasFile ? BorderStyle.solid : BorderStyle.none,
          ),
          color: hasFile
              ? const Color(0xFF4CAF50).withOpacity(0.05)
              : Colors.grey[50],
        ),
        child: Row(
          children: [
            // Thumbnail or placeholder
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: hasFile
                  ? (kIsWeb
                      ? Image.network(
                          file!.path,
                          width: 72,
                          height: 72,
                          fit: BoxFit.cover,
                        )
                      : Image.file(
                          File(file!.path),
                          width: 72,
                          height: 72,
                          fit: BoxFit.cover,
                        ))
                  : Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: Colors.grey[200],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.grey[400]!,
                          style: BorderStyle.solid,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(icon, size: 28, color: Colors.grey[500]),
                          const SizedBox(height: 2),
                          Icon(Icons.add_a_photo,
                              size: 14, color: Colors.grey[400]),
                        ],
                      ),
                    ),
            ),
            const SizedBox(width: 16),

            // Text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      if (isRequired)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: hasFile
                                ? const Color(0xFF4CAF50).withOpacity(0.1)
                                : Colors.orange.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            hasFile ? '✓ Done' : 'Required',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: hasFile
                                  ? const Color(0xFF4CAF50)
                                  : Colors.orange[700],
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                  ),
                  if (!hasFile) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Tap to upload',
                      style: TextStyle(
                        fontSize: 12,
                        color: const Color(0xFF4CAF50).withOpacity(0.8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Clear button
            if (hasFile)
              IconButton(
                onPressed: onClear,
                icon: const Icon(Icons.close, size: 20),
                color: Colors.grey[500],
                tooltip: 'Remove',
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    return Row(
      children: [
        _buildStepCircle(1, 'Details', isActive: false, isCompleted: true),
        Expanded(
          child: Container(
            height: 2,
            color: const Color(0xFF4CAF50),
          ),
        ),
        _buildStepCircle(2, 'Documents', isActive: true, isCompleted: false),
      ],
    );
  }

  Widget _buildStepCircle(int step, String label,
      {required bool isActive, required bool isCompleted}) {
    final Color bgColor;
    final Widget child;

    if (isCompleted) {
      bgColor = const Color(0xFF4CAF50);
      child = const Icon(Icons.check, color: Colors.white, size: 20);
    } else if (isActive) {
      bgColor = const Color(0xFF4CAF50);
      child = Text(
        '$step',
        style: const TextStyle(
            color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
      );
    } else {
      bgColor = Colors.grey[300]!;
      child = Text(
        '$step',
        style: TextStyle(
            color: Colors.grey[600], fontWeight: FontWeight.bold, fontSize: 16),
      );
    }

    return Column(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(shape: BoxShape.circle, color: bgColor),
          child: Center(child: child),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: (isActive || isCompleted)
                ? const Color(0xFF4CAF50)
                : Colors.grey[500],
            fontWeight:
                (isActive || isCompleted) ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ],
    );
  }
}
