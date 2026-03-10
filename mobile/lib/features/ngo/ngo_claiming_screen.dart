import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../main.dart';
import '../../models/task.dart';
import 'widgets/donation_card.dart';
import 'widgets/qr_code_dialog.dart';

/// NGO Claiming Screen
/// Displays available food donations and allows NGOs to claim them
class NgoClaimingScreen extends ConsumerStatefulWidget {
  final bool showAppBar;
  final VoidCallback? onClaimSuccess;
  
  const NgoClaimingScreen({super.key, this.showAppBar = true, this.onClaimSuccess});

  @override
  ConsumerState<NgoClaimingScreen> createState() => _NgoClaimingScreenState();
}

class _NgoClaimingScreenState extends ConsumerState<NgoClaimingScreen> {
  
  List<Task> _donations = [];
  List<Task> _filteredDonations = [];
  bool _isLoading = false;
  String? _error;
  String? _claimingDonationId; // Track which donation is being claimed
  FoodType? _selectedFilter; // null = All

  @override
  void initState() {
    super.initState();
    _loadDonations();
  }

  /// Apply filter to donations
  void _applyFilter() {
    if (_selectedFilter == null) {
      _filteredDonations = List.from(_donations);
    } else {
      _filteredDonations = _donations
          .where((d) => d.foodType == _selectedFilter)
          .toList();
    }
  }

  /// Set the filter
  void _setFilter(FoodType? filter) {
    setState(() {
      _selectedFilter = (_selectedFilter == filter) ? null : filter;
      _applyFilter();
    });
  }

  /// Load available donations from API
  Future<void> _loadDonations() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final apiService = ref.read(apiServiceProvider);
      final List<dynamic> data = await apiService.getNgoNearbyTasks();
      final donations = data.map((json) => Task.fromJson(json)).toList();
      
      // Filter out expired donations on the client side as well if needed
      // preventing null expiryTime issues
      final now = DateTime.now();
      final validDonations = donations.where((d) {
        if (d.expiryTime == null) return true;
        return d.expiryTime!.isAfter(now);
      }).toList();

      if (mounted) {
        setState(() {
          _donations = validDonations;
          _applyFilter();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          // Check if error is 403 (Forbidden) -> Pending Approval
          if (e.toString().contains('403') || e.toString().contains('Forbidden')) {
             _error = 'PENDING_APPROVAL';
          } else {
             _error = e.toString();
          }
          _isLoading = false;
        });
        
        // Only show snackbar for non-403 errors
        if (_error != 'PENDING_APPROVAL') {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error loading donations: ${e.toString()}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  /// Claim a donation
  Future<void> _claimDonation(Task donation) async {
    setState(() {
      _claimingDonationId = donation.id;
    });

    try {
      final apiService = ref.read(apiServiceProvider);
      final response = await apiService.claimTask(donation.id);
      final claimedTask = Task.fromJson(response);
      
      if (mounted) {
        // Show QR code dialog
        await showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => QrCodeDialog(
            donationId: donation.id,
            qrData: claimedTask.deliveryToken ?? donation.id,
            donorName: "Donor", // Placeholder until we have real donor name
          ),
        );

        // Remove claimed donation from list
        setState(() {
          _donations.removeWhere((d) => d.id == donation.id);
          _claimingDonationId = null;
        });

        // Notify parent dashboard
        widget.onClaimSuccess?.call();

        // Show success message
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Claimed! Added to My Claims'),
              backgroundColor: Color(0xFF4CAF50),
              duration: Duration(seconds: 3),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _claimingDonationId = null;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to claim: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      appBar: widget.showAppBar ? AppBar(
        title: const Text(
          'Available Donations',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: const Color(0xFF4CAF50),
        foregroundColor: Colors.white,
        elevation: 2,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLoading ? null : _loadDonations,
            tooltip: 'Refresh',
          ),
        ],
      ) : null,
      body: RefreshIndicator(
        onRefresh: _loadDonations,
        color: const Color(0xFF4CAF50),
        child: _buildBody(),
      ),
    );
  }

  /// Build filter chip
  Widget _buildFilterChip(String label, FoodType filterValue, Color color, IconData icon) {
    final isSelected = _selectedFilter == filterValue;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: isSelected ? Colors.white : color),
            const SizedBox(width: 4),
            Text(label),
          ],
        ),
        selected: isSelected,
        onSelected: (_) => _setFilter(filterValue),
        selectedColor: color,
        checkmarkColor: Colors.white,
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : Colors.black87,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: color.withOpacity(0.5)),
        ),
        elevation: isSelected ? 2 : 0,
      ),
    );
  }

  /// Build the filter bar
  Widget _buildFilterBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.filter_list, size: 18, color: Colors.grey),
              const SizedBox(width: 8),
              Text(
                'Filter by type:',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade700,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              Text(
                '${_filteredDonations.length} of ${_donations.length}',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('Veg/Vegetables', FoodType.veg, Colors.green, Icons.eco),
                _buildFilterChip('Non-Veg', FoodType.nonVeg, Colors.red, Icons.restaurant),
                _buildFilterChip('Mixed', FoodType.mixed, Colors.orange, Icons.lunch_dining),
                _buildFilterChip('Snack', FoodType.snack, Colors.purple, Icons.cookie),
                _buildFilterChip('Vegan', FoodType.vegan, Colors.teal, Icons.spa),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Build the main body based on current state
  Widget _buildBody() {
    // Loading state
    if (_isLoading && _donations.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF4CAF50)),
            ),
            SizedBox(height: 16),
            Text(
              'Loading donations...',
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ],
        ),
      );
    }
    
    // PENDING APPROVAL STATE
    if (_error == 'PENDING_APPROVAL') {
      return ListView(
        children: [
           SizedBox(height: MediaQuery.of(context).size.height * 0.2),
           Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.verified_user_outlined, size: 80, color: Colors.orange),
                  const SizedBox(height: 24),
                  const Text(
                    'Registration Pending',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Your NGO account is currently awaiting admin approval. Once verified, you will be able to view and claim donations here.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 16, color: Colors.grey),
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton.icon(
                    onPressed: _loadDonations,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Check Status'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    // Generic Error state
    if (_error != null && _donations.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red.shade300),
              const SizedBox(height: 16),
              const Text(
                'Failed to load donations',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _loadDonations,
                icon: const Icon(Icons.refresh),
                label: const Text('RETRY'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4CAF50),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Empty state
    if (_donations.isEmpty) {
      return ListView(
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * 0.3),
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.inbox_outlined, size: 80, color: Colors.grey.shade400),
                const SizedBox(height: 16),
                const Text(
                  'No donations available',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text('Check back later or pull to refresh'),
              ],
            ),
          ),
        ],
      );
    }

    // Donation list
    return Column(
      children: [
        _buildFilterBar(),
        Expanded(
          child: _filteredDonations.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.filter_alt_off, size: 64, color: Colors.grey),
                      const SizedBox(height: 16),
                      const Text('No matching donations'),
                      TextButton(
                        onPressed: () => _setFilter(null),
                        child: const Text('Clear filter'),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: _filteredDonations.length,
                  itemBuilder: (context, index) {
                    final donation = _filteredDonations[index];
                    final isClaimingThis = _claimingDonationId == donation.id;
                    
                    return DonationCard(
                      task: donation,
                      onClaim: () => _claimDonation(donation),
                      isLoading: isClaimingThis,
                    );
                  },
                ),
        ),
      ],
    );
  }
}
