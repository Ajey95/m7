import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../main.dart';
import '../../services/location_service.dart';

class RouteScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> task;

  const RouteScreen({super.key, required this.task});

  @override
  ConsumerState<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends ConsumerState<RouteScreen> {
  final LocationService _locationService = LocationService();
  GoogleMapController? _mapController;
  Position? _currentPosition;
  Timer? _locationTimer;
  
  bool _isPickedUp = false;
  bool _isDelivered = false;
  bool _showScanner = false;
  bool _isProcessingScan = false; // Prevent multiple scans
  Map<String, dynamic>? _task;
  
  // Scanner controller
  final MobileScannerController _scannerController = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
    torchEnabled: false,
    returnImage: false,
  );

  late LatLng _pickupLocation;
  LatLng? _dropLocation;
  bool _isVerifying = false;

  @override
  void initState() {
    super.initState();
    _initLocations();
    _startLocationTracking();
  }

  void _initLocations() {
    _pickupLocation = LatLng(
      (widget.task['pickup_lat'] ?? 0).toDouble(),
      (widget.task['pickup_lng'] ?? 0).toDouble(),
    );
    
    if (widget.task['drop_lat'] != null && widget.task['drop_lng'] != null) {
      _dropLocation = LatLng(
        widget.task['drop_lat'].toDouble(),
        widget.task['drop_lng'].toDouble(),
      );
    }
    
    // Initialize state based on task status (for resumed tasks)
    final status = widget.task['status'];
    if (['IN_TRANSIT', 'PICKED_UP'].contains(status)) {
      _isPickedUp = true;
    }
    if (status == 'COMPLETED') {
      _isPickedUp = true;
      _isDelivered = true;
    }
  }

  void _startLocationTracking() {
    _locationTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      final position = await _locationService.getCurrentPosition();
      if (position != null && mounted) {
        setState(() {
          _currentPosition = position;
        });
        
        // Update location to backend
        try {
          final apiService = ref.read(apiServiceProvider);
          await apiService.updateLocation(position.latitude, position.longitude);
        } catch (e) {
          // Ignore errors
        }
      }
    });
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    _mapController?.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  Set<Marker> _buildMarkers() {
    final markers = <Marker>{};

    // Current location marker
    if (_currentPosition != null) {
      markers.add(Marker(
        markerId: const MarkerId('current'),
        position: LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        infoWindow: const InfoWindow(title: 'You'),
      ));
    }

    // Pickup marker
    if (!_isPickedUp) {
      markers.add(Marker(
        markerId: const MarkerId('pickup'),
        position: _pickupLocation,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        infoWindow: const InfoWindow(title: 'Pickup Location'),
      ));
    }

    // Drop marker
    if (_isPickedUp && _dropLocation != null && !_isDelivered) {
      markers.add(Marker(
        markerId: const MarkerId('drop'),
        position: _dropLocation!,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        infoWindow: const InfoWindow(title: 'Delivery Location'),
      ));
    }

    return markers;
  }

  void _openQRScanner() {
    setState(() => _showScanner = true);
  }

  Future<void> _onQRDetected(String qrToken) async {
    if (_isProcessingScan) return;
    
    setState(() {
      _isProcessingScan = true;
      _showScanner = false; // Close scanner immediately
    });

    try {
      final apiService = ref.read(apiServiceProvider);
      
      if (!_isPickedUp) {
        // Verify pickup
        await apiService.verifyPickup(widget.task['id'], qrToken);
        setState(() => _isPickedUp = true);
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Pickup verified! Head to delivery location.'),
            backgroundColor: Color(0xFF4CAF50),
          ),
        );
      } else {
        // Verify delivery
        await apiService.verifyDelivery(widget.task['id'], qrToken);
        setState(() => _isDelivered = true);
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Delivery completed! Great job!'),
            backgroundColor: Color(0xFF4CAF50),
          ),
        );

        // Return to home after short delay
        await Future.delayed(const Duration(seconds: 2));
        if (mounted) {
          Navigator.pop(context);
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Verification failed: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isVerifying = false;
          _isProcessingScan = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_showScanner) {
      return Scaffold(
        appBar: AppBar(
          title: Text(_isPickedUp ? 'Scan Delivery QR' : 'Scan Pickup QR'),
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => setState(() => _showScanner = false),
          ),
        ),
        body: MobileScanner(
          controller: _scannerController,
          onDetect: (capture) {
            final barcode = capture.barcodes.firstOrNull;
            if (barcode?.rawValue != null) {
              _onQRDetected(barcode!.rawValue!);
            }
          },
          errorBuilder: (context, error, child) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error, color: Colors.red, size: 50),
                  const SizedBox(height: 16),
                  Text(
                    'Camera Error: ${error.errorCode}',
                    style: const TextStyle(color: Colors.white),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => setState(() => _showScanner = false),
                    child: const Text('Close Scanner'),
                  ),
                ],
              ),
            );
          },
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_isPickedUp ? 'Delivering' : 'Heading to Pickup'),
        backgroundColor: _isPickedUp ? Colors.orange : const Color(0xFF4CAF50),
        foregroundColor: Colors.white,
      ),
      body: Stack(
        children: [
          // Map
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: _pickupLocation,
              zoom: 14,
            ),
            onMapCreated: (controller) => _mapController = controller,
            markers: _buildMarkers(),
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
          ),

          // Bottom Panel
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Task info
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4CAF50).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.restaurant, color: Color(0xFF4CAF50)),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${widget.task['quantity_kg'] ?? 0} kg ${widget.task['food_type'] ?? 'Food'}',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              _isPickedUp ? 'Head to delivery location' : 'Navigate to pickup',
                              style: TextStyle(color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Status indicator
                  Row(
                    children: [
                      const _StatusDot(isComplete: true, label: 'Assigned'),
                      _StatusLine(isComplete: _isPickedUp),
                      _StatusDot(isComplete: _isPickedUp, label: 'Picked Up'),
                      _StatusLine(isComplete: _isDelivered),
                      _StatusDot(isComplete: _isDelivered, label: 'Delivered'),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Scan QR Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _isDelivered ? null : _openQRScanner,
                      icon: const Icon(Icons.qr_code_scanner),
                      label: Text(_isPickedUp ? 'Scan Delivery QR' : 'Scan Pickup QR'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _isPickedUp ? Colors.orange : const Color(0xFF4CAF50),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  final bool isComplete;
  final String label;

  const _StatusDot({required this.isComplete, required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: isComplete ? const Color(0xFF4CAF50) : Colors.grey[300],
            shape: BoxShape.circle,
          ),
          child: isComplete
              ? const Icon(Icons.check, size: 16, color: Colors.white)
              : null,
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: isComplete ? const Color(0xFF4CAF50) : Colors.grey,
          ),
        ),
      ],
    );
  }
}

class _StatusLine extends StatelessWidget {
  final bool isComplete;

  const _StatusLine({required this.isComplete});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        height: 3,
        margin: const EdgeInsets.only(bottom: 18),
        color: isComplete ? const Color(0xFF4CAF50) : Colors.grey[300],
      ),
    );
  }
}
