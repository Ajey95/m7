import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../main.dart';
import '../../services/location_service.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

/// NGO Profile/Dashboard screen showing organization details
class NgoProfileScreen extends ConsumerStatefulWidget {
  const NgoProfileScreen({super.key});

  @override
  ConsumerState<NgoProfileScreen> createState() => _NgoProfileScreenState();
}

class _NgoProfileScreenState extends ConsumerState<NgoProfileScreen> {
  final LocationService _locationService = LocationService();
  Map<String, dynamic>? _ngoData;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadNgoDetails();
  }

  Future<void> _loadNgoDetails() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final apiService = ref.read(apiServiceProvider);
      final data = await apiService.getNgoProfile();
      if (mounted) {
        setState(() {
          _ngoData = data;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF4CAF50)),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
            const SizedBox(height: 16),
             Text(
              'Failed to load profile',
              style: TextStyle(fontSize: 18, color: Colors.grey[600]),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _loadNgoDetails,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4CAF50),
                foregroundColor: Colors.white,
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_ngoData == null) {
      return const Center(child: Text('No data available'));
    }

    return RefreshIndicator(
      onRefresh: _loadNgoDetails,
      color: const Color(0xFF4CAF50),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildInfoCard(),
            const SizedBox(height: 16),
            _buildCapacityCard(),
            const SizedBox(height: 16),
            _buildContactCard(),
          ],
        ),
      ),
    );
  }

  Future<void> _updateLocation() async {
    final useGps = await _showLocationSourceDialog();
    if (useGps == null) return;

    setState(() => _isLoading = true);
    
    try {
      Position? position;
      
      if (useGps) {
        position = await _locationService.getCurrentPosition();
        if (position == null) throw Exception('Location not available');
      } else {
        position = await _showManualLocationDialog();
      }

      if (position != null) {
        String address = 'Location: ${position.latitude}, ${position.longitude}';
        try {
          final placemarks = await placemarkFromCoordinates(
            position.latitude,
            position.longitude,
          );
          if (placemarks.isNotEmpty) {
            final place = placemarks.first;
            address = '${place.street ?? ''}, ${place.locality ?? ''}, ${place.administrativeArea ?? ''}, ${place.country ?? ''}'.replaceAll(', ,', ',').trim();
            if (address.startsWith(',')) address = address.substring(1).trim();
            if (address.endsWith(',')) address = address.substring(0, address.length - 1).trim();
          }
        } catch (e) {
          print('Reverse geocoding failed: $e');
        }

        final apiService = ref.read(apiServiceProvider);
        await apiService.updateNgoProfile(
          latitude: position.latitude,
          longitude: position.longitude,
          address: address,
        );
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Location and address updated!\n$address'),
              backgroundColor: Colors.green,
            ),
          );
          _loadNgoDetails();
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
        setState(() => _isLoading = false);
      }
    }
  }

  Future<bool?> _showLocationSourceDialog() async {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Location Source'),
        content: const Text('How would you like to set your location?'),
        actions: [
          TextButton.icon(
            icon: const Icon(Icons.keyboard),
            label: const Text('Manual Entry'),
            onPressed: () => Navigator.pop(ctx, false),
          ),
          FilledButton.icon(
            icon: const Icon(Icons.gps_fixed),
            label: const Text('Use GPS'),
            onPressed: () => Navigator.pop(ctx, true),
          ),
        ],
      ),
    );
  }

  Future<Position?> _showManualLocationDialog() async {
    final addressController = TextEditingController();
    final latController = TextEditingController();
    final lngController = TextEditingController();
    
    return showDialog<Position>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Enter Location'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: addressController,
                decoration: const InputDecoration(
                  labelText: 'Address (City, Street)',
                  hintText: 'e.g. New York, NY',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              const Text('- OR -', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: latController,
                      decoration: const InputDecoration(labelText: 'Lat', border: OutlineInputBorder()),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: lngController,
                      decoration: const InputDecoration(labelText: 'Lng', border: OutlineInputBorder()),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              try {
                double lat, lng;
                if (addressController.text.isNotEmpty) {
                  final locations = await locationFromAddress(addressController.text);
                  if (locations.isNotEmpty) {
                    lat = locations.first.latitude;
                    lng = locations.first.longitude;
                  } else {
                    throw Exception('Address not found');
                  }
                } else {
                  lat = double.parse(latController.text);
                  lng = double.parse(lngController.text);
                }
                
                if (ctx.mounted) {
                  Navigator.pop(ctx, Position(
                    longitude: lng,
                    latitude: lat,
                    timestamp: DateTime.now(),
                    accuracy: 0,
                    altitude: 0,
                    heading: 0,
                    speed: 0,
                    speedAccuracy: 0, 
                    altitudeAccuracy: 0, 
                    headingAccuracy: 0, 
                    floor: 0,
                    isMocked: true 
                  ));
                }
              } catch (e) {
                if (ctx.mounted) {
                   ScaffoldMessenger.of(ctx).showSnackBar(
                     SnackBar(content: Text('Invalid location: $e'), backgroundColor: Colors.red),
                   );
                }
              }
            },
            child: const Text('Set Location'),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard() {
    final approvalStatus = _ngoData!['approval_status'] ?? 'PENDING';
    final statusColor = approvalStatus == 'APPROVED' 
        ? Colors.green 
        : approvalStatus == 'REJECTED' 
            ? Colors.red 
            : Colors.orange;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.business,
                    size: 32,
                    color: Color(0xFF4CAF50),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _ngoData!['name'] ?? 'NGO Name',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          approvalStatus,
                          style: TextStyle(
                            color: statusColor,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            OutlinedButton.icon(
              onPressed: _updateLocation,
              icon: const Icon(Icons.my_location),
              label: const Text('Update GPS Location'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(45),
                foregroundColor: const Color(0xFF4CAF50),
                side: const BorderSide(color: Color(0xFF4CAF50)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCapacityCard() {
    final capacity = (_ngoData!['storage_capacity'] ?? 0).toDouble();
    final stored = (_ngoData!['total_stored'] ?? 0).toDouble();
    final available = (capacity - stored).clamp(0, capacity);
    final usagePercent = capacity > 0 ? (stored / capacity) : 0.0;

    Color progressColor;
    if (usagePercent >= 0.9) {
      progressColor = Colors.red;
    } else if (usagePercent >= 0.7) {
      progressColor = Colors.orange;
    } else {
      progressColor = const Color(0xFF4CAF50);
    }

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.warehouse, color: Color(0xFF4CAF50)),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Storage Capacity',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${stored.toStringAsFixed(1)} / ${capacity.toStringAsFixed(1)} kg',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[700],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: usagePercent.clamp(0.0, 1.0),
                minHeight: 12,
                backgroundColor: Colors.grey[200],
                valueColor: AlwaysStoppedAnimation<Color>(progressColor),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: _buildCapacityStat(
                    'Currently Stored',
                    '${stored.toStringAsFixed(1)} kg',
                    Colors.blue,
                  ),
                ),
                Expanded(
                  child: _buildCapacityStat(
                    'Available',
                    '${available.toStringAsFixed(1)} kg',
                    available <= 20 ? Colors.red : Colors.green,
                  ),
                ),
                Expanded(
                  child: _buildCapacityStat(
                    'Total Capacity',
                    '${capacity.toStringAsFixed(1)} kg',
                    Colors.grey,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCapacityStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: color,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildContactCard() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.contact_phone, color: Color(0xFF4CAF50)),
                SizedBox(width: 8),
                Text(
                  'Contact Information',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildContactRow(
              Icons.email,
              'Email',
              _ngoData!['email'] ?? 'Not specified',
            ),
            const SizedBox(height: 12),
            _buildContactRow(
              Icons.phone,
              'Phone',
              _ngoData!['phone'] ?? 'Not specified',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContactRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.grey[600]),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[500],
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
