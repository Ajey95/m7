import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import '../../main.dart';
import '../../services/location_service.dart';
import 'create_donation_screen.dart';
import 'donation_history_screen.dart';

class DonorHomeScreen extends ConsumerStatefulWidget {
  const DonorHomeScreen({super.key});

  @override
  ConsumerState<DonorHomeScreen> createState() => _DonorHomeScreenState();
}

class _DonorHomeScreenState extends ConsumerState<DonorHomeScreen> {
  int _currentIndex = 0;
  Map<String, dynamic>? _donorProfile;
  bool _isLoading = true;
  final LocationService _locationService = LocationService();

  Key _refreshKey = UniqueKey();

  @override
  void initState() {
    super.initState();
    _loadDonorProfile();
  }

  Future<void> _loadDonorProfile() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      final profile = await apiService.getDonorProfile();
      setState(() {
        _donorProfile = profile;
        _isLoading = false;
      });
    } catch (e) {
      print('Error loading donor profile: $e'); // Add debug log
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading profile: $e')),
        );
      }
    }
  }

  Future<void> _logout() async {
    final apiService = ref.read(apiServiceProvider);
    await apiService.clearToken();
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  Future<void> _updateLocation() async {
    final choice = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Update Location'),
        content: const Text('Choose how to update your location:'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, 'gps'),
            child: const Text('Use GPS'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, 'manual'),
            child: const Text('Manual Entry'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );

    if (choice == null) return;

    if (choice == 'gps') {
      await _updateLocationViaGPS();
    } else if (choice == 'manual') {
      await _showManualLocationDialog();
    }
  }

  Future<void> _updateLocationViaGPS() async {
    try {
      final position = await _locationService.getCurrentPosition();
      if (position != null) {
        // Get address from coordinates using reverse geocoding
        String address = 'Location: ${position.latitude}, ${position.longitude}';
        try {
          final placemarks = await placemarkFromCoordinates(
            position.latitude,
            position.longitude,
          );
          if (placemarks.isNotEmpty) {
            final place = placemarks.first;
            address = '${place.street ?? ''}, ${place.locality ?? ''}, ${place.administrativeArea ?? ''}, ${place.country ?? ''}'.replaceAll(', ,', ',').trim();
            // Remove leading/trailing commas
            if (address.startsWith(',')) address = address.substring(1).trim();
            if (address.endsWith(',')) address = address.substring(0, address.length - 1).trim();
          }
        } catch (e) {
          print('Reverse geocoding failed: $e');
          // Continue with coordinate-based address
        }

        final apiService = ref.read(apiServiceProvider);
        await apiService.updateDonorProfile(
          latitude: position.latitude,
          longitude: position.longitude,
          address: address,
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Location and address updated!\n$address'),
              backgroundColor: const Color(0xFF4CAF50),
              duration: const Duration(seconds: 3),
            ),
          );
          _loadDonorProfile();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error updating location: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _showManualLocationDialog() async {
    final addressController = TextEditingController();
    final latController = TextEditingController();
    final lngController = TextEditingController();
    bool useCoordinates = false;

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Manual Location Entry'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Text('Use Coordinates:'),
                  Switch(
                    value: useCoordinates,
                    onChanged: (value) {
                      setState(() {
                        useCoordinates = value;
                      });
                    },
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (!useCoordinates)
                TextField(
                  controller: addressController,
                  decoration: const InputDecoration(
                    labelText: 'Address',
                    hintText: 'Enter full address',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                )
              else
                Column(
                  children: [
                    TextField(
                      controller: latController,
                      decoration: const InputDecoration(
                        labelText: 'Latitude',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: lngController,
                      decoration: const InputDecoration(
                        labelText: 'Longitude',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ],
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context);
                if (useCoordinates) {
                  await _updateLocationFromCoordinates(
                    double.tryParse(latController.text),
                    double.tryParse(lngController.text),
                  );
                } else {
                  await _updateLocationFromAddress(addressController.text);
                }
              },
              child: const Text('Update'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _updateLocationFromAddress(String address) async {
    if (address.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter an address'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    try {
      final locations = await locationFromAddress(address);
      if (locations.isNotEmpty) {
        final location = locations.first;
        await _updateDonorLocationAPI(location.latitude, location.longitude, address);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not find location for address: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _updateLocationFromCoordinates(double? lat, double? lng) async {
    if (lat == null || lng == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter valid coordinates'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    try {
      final placemarks = await placemarkFromCoordinates(lat, lng);
      String address = 'Location: $lat, $lng';
      if (placemarks.isNotEmpty) {
        final place = placemarks.first;
        address = '${place.street}, ${place.locality}, ${place.country}';
      }
      await _updateDonorLocationAPI(lat, lng, address);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _updateDonorLocationAPI(double lat, double lng, String address) async {
    try {
      final apiService = ref.read(apiServiceProvider);
      await apiService.updateDonorProfile(
        latitude: lat,
        longitude: lng,
        address: address,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Location and address updated successfully!'),
            backgroundColor: Color(0xFF4CAF50),
          ),
        );
        _loadDonorProfile();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error updating location: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Food Rescue'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: _currentIndex == 0
          ? _buildDashboard()
          : DonationHistoryScreen(key: _refreshKey),
      floatingActionButton: _currentIndex == 0
          ? FloatingActionButton.extended(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const CreateDonationScreen(),
                  ),
                ).then((_) {
                  _loadDonorProfile();
                  // Force history refresh if we are on history tab or going to it
                  setState(() {
                    _refreshKey = UniqueKey();
                  });
                });
              },
              icon: const Icon(Icons.add),
              label: const Text('New Donation'),
              backgroundColor: const Color(0xFF4CAF50),
              foregroundColor: Colors.white,
            )
          : null,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        selectedItemColor: const Color(0xFF4CAF50),
        items: const [
          BottomNavigationBarItem(
             icon: Icon(Icons.home),
             label: 'Home',
          ),
          BottomNavigationBarItem(
             icon: Icon(Icons.history),
             label: 'History',
          ),
        ],
      ),
    );
  }


  Widget _buildDashboard() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Welcome Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.volunteer_activism, size: 40, color: Colors.white),
                const SizedBox(height: 16),
                Text(
                  'Hello, ${_donorProfile?['organization_name'] ?? 'Donor'}!',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Total Donations: ${_donorProfile?['total_donations'] ?? 0}',
                  style: const TextStyle(fontSize: 16, color: Colors.white70),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Quick Stats
          const Text(
            'Quick Stats',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.food_bank,
                  title: 'Donations',
                  value: '${_donorProfile?['total_donations'] ?? 0}',
                  color: const Color(0xFF4CAF50),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.star,
                  title: 'Rating',
                  value: '${(_donorProfile?['rating'] ?? 5.0).toStringAsFixed(1)}',
                  color: const Color(0xFFFFC107),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Current Address Section
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[850],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[700]!),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.location_on, color: Colors.blue[400], size: 20),
                    const SizedBox(width: 8),
                    const Text(
                      'Current Address',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  _donorProfile?['address'] ?? 'No address set - please update',
                  style: TextStyle(
                    fontSize: 14,
                    color: (_donorProfile?['address'] == null) ? Colors.orange : Colors.white70,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Update Location Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _updateLocation,
              icon: const Icon(Icons.location_on),
              label: const Text('Update Location & Address'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2196F3),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // How it works
          const Text(
            'How to Donate',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          const _HowItWorksStep(
            number: '1',
            title: 'Create Donation',
            description: 'Tap + button to add food details',
          ),
          const _HowItWorksStep(
            number: '2',
            title: 'Wait for Pickup',
            description: 'A volunteer will be assigned',
          ),
          const _HowItWorksStep(
            number: '3',
            title: 'QR Verification',
            description: 'Volunteer scans QR to confirm pickup',
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            title,
            style: TextStyle(color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }
}

class _HowItWorksStep extends StatelessWidget {
  final String number;
  final String title;
  final String description;

  const _HowItWorksStep({
    required this.number,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: const Color(0xFF4CAF50),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                number,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  description,
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
