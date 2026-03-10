import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../main.dart';
import '../../services/location_service.dart';
import 'route_screen.dart';
import 'package:geocoding/geocoding.dart';

class VolunteerHomeScreen extends ConsumerStatefulWidget {
  const VolunteerHomeScreen({super.key});

  @override
  ConsumerState<VolunteerHomeScreen> createState() => _VolunteerHomeScreenState();
}

class _VolunteerHomeScreenState extends ConsumerState<VolunteerHomeScreen> {
  final LocationService _locationService = LocationService();
  
  bool _isOnline = false;
  bool _isLoading = false;
  bool _hasTask = false;
  Map<String, dynamic>? _currentTask;
  Map<String, dynamic>? _volunteerProfile;
  Position? _currentPosition;
  Timer? _taskPollingTimer;
  Timer? _locationUpdateTimer;

  @override
  void initState() {
    super.initState();
    _loadVolunteerProfile();
  }

  @override
  void dispose() {
    _taskPollingTimer?.cancel();
    _locationUpdateTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadVolunteerProfile() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      final profile = await apiService.getVolunteerProfile();
      setState(() {
        _volunteerProfile = profile;
      });
    } catch (e) {
      // Profile may not exist yet
    }
  }

  Future<void> _toggleOnlineStatus() async {
    if (_isOnline) {
      // Going offline
      setState(() => _isLoading = true);
      try {
        final apiService = ref.read(apiServiceProvider);
        await apiService.goOffline();
        _taskPollingTimer?.cancel();
        _locationUpdateTimer?.cancel();
        setState(() {
          _isOnline = false;
          _currentTask = null;
          _hasTask = false;
        });
      } catch (e) {
        _showError('Error going offline: $e');
      } finally {
        setState(() => _isLoading = false);
      }
      return;
    }

    // Going Online - Ask for location source
    final useGps = await _showLocationSourceDialog();
    if (useGps == null) return; // Cancelled

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
        final apiService = ref.read(apiServiceProvider);
        await apiService.goOnline(position.latitude, position.longitude);
        
        setState(() {
          _isOnline = true;
          _currentPosition = position;
        });

        // Check for assigned tasks immediately
        await _checkForTask();
        // Start polling for tasks
        _startTaskPolling();
        // Only start location updates if using GPS
        if (useGps) _startLocationUpdates();
      }
    } catch (e) {
      _showError('Error going online: $e');
    } finally {
      setState(() => _isLoading = false);
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
                  // Geocode address
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
                // Show error
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

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  Future<void> _checkForTask() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      final task = await apiService.getCurrentTask();
      
      if (task != null && mounted) {
        setState(() {
          _currentTask = task;
          _hasTask = true;
        });
      } else if (mounted) {
        setState(() {
          _currentTask = null;
          _hasTask = false;
        });
      }
    } catch (e) {
      // Ignore errors during check
    }
  }

  Future<void> _manualRefresh() async {
    setState(() => _isLoading = true);
    await _checkForTask();
    setState(() => _isLoading = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_hasTask ? 'Task found!' : 'No tasks available'),
          backgroundColor: _hasTask ? Colors.green : Colors.grey,
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  void _startTaskPolling() {
    _taskPollingTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      if (!_isOnline) return;
      // Always check — don't skip if _hasTask, in case task was updated
      await _checkForTask();
    });
  }

  void _startLocationUpdates() {
    _locationUpdateTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      if (!_isOnline) return;

      try {
        final position = await _locationService.getCurrentPosition();
        if (position != null) {
          final apiService = ref.read(apiServiceProvider);
          await apiService.updateLocation(position.latitude, position.longitude);
          setState(() {
            _currentPosition = position;
          });
        }
      } catch (e) {
        // Ignore errors during location updates
      }
    });
  }

  Future<void> _acceptTask() async {
    if (_currentTask == null) return;

    try {
      final apiService = ref.read(apiServiceProvider);
      await apiService.acceptTask(_currentTask!['id']);
      
      if (mounted) {
        _resumeTask(); // Navigate after acceptance
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to accept task: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _resumeTask() {
    if (_currentTask == null) return;
    
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => RouteScreen(task: _currentTask!),
      ),
    ).then((_) {
      // Reset after returning from route
      setState(() {
        _currentTask = null;
        _hasTask = false;
      });
      // Immediately check again in case task isn't done
      _checkForTask();
    });
  }

  Future<void> _logout() async {
    if (_isOnline) {
      await ref.read(apiServiceProvider).goOffline();
    }
    await ref.read(apiServiceProvider).clearToken();
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Volunteer'),
        actions: [
          if (_isOnline)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _isLoading ? null : _manualRefresh,
              tooltip: 'Refresh tasks',
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Status Card
              _buildStatusCard(),
              const SizedBox(height: 24),

              // Task Card (if assigned)
              if (_hasTask && _currentTask != null) _buildTaskCard(),

              // Waiting message
              if (_isOnline && !_hasTask) _buildWaitingCard(),

              // Stats (when offline)
              if (!_isOnline) _buildOfflineContent(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: _isOnline
              ? [const Color(0xFF4CAF50), const Color(0xFF66BB6A)]
              : [Colors.grey.shade400, Colors.grey.shade500],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _isOnline ? 'You are Online' : 'You are Offline',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _isOnline ? 'Waiting for tasks...' : 'Go online to receive tasks',
                    style: const TextStyle(color: Colors.white70),
                  ),
                ],
              ),
              Icon(
                _isOnline ? Icons.signal_wifi_4_bar : Icons.signal_wifi_off,
                size: 40,
                color: Colors.white,
              ),
            ],
          ),
          const SizedBox(height: 24),
          // Toggle Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _toggleOnlineStatus,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: _isOnline ? Colors.red : const Color(0xFF4CAF50),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      _isOnline ? 'Go Offline' : 'Go Online',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.notifications_active, color: Colors.orange.shade700),
              const SizedBox(width: 8),
              Text(
                ['PICKED_UP', 'IN_TRANSIT'].contains(_currentTask!['status']) 
                    ? 'Task In Progress' 
                    : 'New Task Available!',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.orange.shade800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildTaskDetail(Icons.restaurant, 'Food Type', _currentTask!['food_type'] ?? 'Mixed'),
          _buildTaskDetail(Icons.scale, 'Quantity', '${_currentTask!['quantity_kg'] ?? 0} kg'),
          if (_currentTask!['requires_cooling'] == true)
            _buildTaskDetail(Icons.ac_unit, 'Cooling', 'Required'),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: _buildActionButtons(),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    final status = _currentTask!['status'];
    final isResumable = ['PICKED_UP', 'IN_TRANSIT'].contains(status);

    if (isResumable) {
      return ElevatedButton.icon(
        onPressed: _resumeTask,
        icon: const Icon(Icons.navigation),
        label: const Text('Resume Task'),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
      );
    }

    return ElevatedButton.icon(
      onPressed: _acceptTask,
      icon: const Icon(Icons.check),
      label: const Text('Accept Task'),
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF4CAF50),
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14),
      ),
    );
  }

  Widget _buildTaskDetail(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey[600]),
          const SizedBox(width: 8),
          Text('$label: ', style: TextStyle(color: Colors.grey[600])),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildWaitingCard() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Icon(Icons.hourglass_empty, size: 48, color: Colors.grey),
          const SizedBox(height: 16),
          Text(
            'Waiting for tasks...',
            style: TextStyle(fontSize: 18, color: Colors.grey[700]),
          ),
          const SizedBox(height: 8),
          Text(
            'Stay in the app to receive tasks',
            style: TextStyle(color: Colors.grey[500]),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _isLoading ? null : _manualRefresh,
            icon: const Icon(Icons.refresh),
            label: const Text('Check for Tasks'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF4CAF50),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOfflineContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'How it works',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        _buildStep('1', 'Go Online', 'Enable location and start receiving tasks'),
        _buildStep('2', 'Accept Task', 'Review and accept food pickup tasks'),
        _buildStep('3', 'Navigate', 'Use maps to reach pickup location'),
        _buildStep('4', 'Scan QR', 'Verify pickup and delivery with QR codes'),
      ],
    );
  }

  Widget _buildStep(String number, String title, String description) {
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
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(description, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
