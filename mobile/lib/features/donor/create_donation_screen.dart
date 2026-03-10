import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:dio/dio.dart';
import '../../main.dart';
import '../../services/location_service.dart';

class CreateDonationScreen extends ConsumerStatefulWidget {
  const CreateDonationScreen({super.key});

  @override
  ConsumerState<CreateDonationScreen> createState() => _CreateDonationScreenState();
}

class _CreateDonationScreenState extends ConsumerState<CreateDonationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _quantityController = TextEditingController();
  final _locationService = LocationService();

  String _selectedFoodType = 'VEG';
  bool _requiresCooling = false;
  bool _isLoading = false;
  bool _isLoadingLocation = false;
  Position? _currentPosition;

  final List<Map<String, dynamic>> _foodTypes = [
    {'value': 'VEG', 'label': 'Veg', 'icon': Icons.eco},
    {'value': 'NON_VEG', 'label': 'Non-Veg', 'icon': Icons.restaurant_menu},
    {'value': 'VEGAN', 'label': 'Vegan', 'icon': Icons.grass},
    {'value': 'MIXED', 'label': 'Mixed', 'icon': Icons.shopping_basket},
  ];

  @override
  void initState() {
    super.initState();
    _getCurrentLocation();
  }

  Future<void> _getCurrentLocation() async {
    setState(() => _isLoadingLocation = true);
    
    final position = await _locationService.getCurrentPosition();
    
    setState(() {
      _currentPosition = position;
      _isLoadingLocation = false;
    });
  }

  Future<void> _submitDonation() async {
    if (!_formKey.currentState!.validate()) return;
    if (_currentPosition == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please wait for location to be captured'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final apiService = ref.read(apiServiceProvider);
      
      // Calculate expiry time (4 hours from now)
      final expiryTime = DateTime.now().add(const Duration(hours: 4));
      
      await apiService.createDonation(
        pickupLat: _currentPosition!.latitude,
        pickupLng: _currentPosition!.longitude,
        foodType: _selectedFoodType,
        quantityKg: double.parse(_quantityController.text),
        description: _descriptionController.text,
        requiresCooling: _requiresCooling,
        expiryTime: expiryTime,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Donation created successfully!'),
            backgroundColor: Color(0xFF4CAF50),
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      String errorMsg = 'Failed to create donation';
      if (e is DioException) {
        if (e.response != null) {
          print('Create Donation Error Status: ${e.response?.statusCode}');
          print('Create Donation Error Data: ${e.response?.data}');
          
          if (e.response?.data is Map && e.response?.data['detail'] != null) {
            // detailed error from Pydantic
            final detail = e.response?.data['detail'];
            if (detail is List) {
              // combine multiple validation errors
              errorMsg = detail.map((d) => d['msg']).join('\n');
            } else {
              errorMsg = detail.toString();
            }
          } else {
            errorMsg = e.response?.data?.toString() ?? errorMsg;
          }
        } else {
           errorMsg = e.message ?? errorMsg;
        }
      } else {
        errorMsg = e.toString();
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
             label: 'Dismiss',
             textColor: Colors.white,
             onPressed: () {
               ScaffoldMessenger.of(context).hideCurrentSnackBar();
             },
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _quantityController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Donation'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Location Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(Icons.location_on, color: Colors.blue.shade700),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Pickup Location',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: Colors.blue.shade700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          _isLoadingLocation
                              ? const Text('Getting location...')
                              : _currentPosition != null
                                  ? Text(
                                      '${_currentPosition!.latitude.toStringAsFixed(4)}, '
                                      '${_currentPosition!.longitude.toStringAsFixed(4)}',
                                      style: TextStyle(color: Colors.grey[600]),
                                    )
                                  : const Text('Location not available'),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh),
                      onPressed: _getCurrentLocation,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Food Type Selection
              const Text(
                'Food Type',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _foodTypes.map((type) {
                  final isSelected = _selectedFoodType == type['value'];
                  return ChoiceChip(
                    avatar: Icon(
                      type['icon'] as IconData,
                      size: 18,
                      color: isSelected ? Colors.white : Colors.grey[700],
                    ),
                    label: Text(type['label'] as String),
                    selected: isSelected,
                    selectedColor: const Color(0xFF4CAF50),
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : Colors.grey[800],
                    ),
                    onSelected: (selected) {
                      setState(() {
                        _selectedFoodType = type['value'] as String;
                      });
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),

              // Quantity
              TextFormField(
                controller: _quantityController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Quantity (kg)',
                  prefixIcon: Icon(Icons.scale),
                  suffixText: 'kg',
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter quantity';
                  }
                  final qty = double.tryParse(value);
                  if (qty == null || qty <= 0) {
                    return 'Enter a valid quantity';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Description
              TextFormField(
                controller: _descriptionController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Description (optional)',
                  prefixIcon: Icon(Icons.description),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 16),

              // Cooling requirement
              SwitchListTile(
                value: _requiresCooling,
                onChanged: (value) {
                  setState(() {
                    _requiresCooling = value;
                  });
                },
                title: const Text('Requires Cooling'),
                subtitle: const Text('Check if food needs refrigeration'),
                secondary: Icon(
                  Icons.ac_unit,
                  color: _requiresCooling ? Colors.blue : Colors.grey,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                tileColor: Colors.grey[100],
              ),
              const SizedBox(height: 24),

              // Expiry notice
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.schedule, color: Colors.orange.shade700),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Donation will expire in 4 hours',
                        style: TextStyle(color: Colors.orange.shade700),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // Submit Button
              ElevatedButton(
                onPressed: _isLoading ? null : _submitDonation,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4CAF50),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
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
                    : const Text(
                        'Create Donation',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
