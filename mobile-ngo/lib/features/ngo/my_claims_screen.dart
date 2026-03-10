import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../main.dart';
import '../../models/task.dart';
import 'widgets/claimed_donation_card.dart';
import 'widgets/qr_code_dialog.dart';
import 'package:intl/intl.dart';

/// Screen showing all donations claimed by the current NGO
class MyClaimsScreen extends ConsumerStatefulWidget {
  const MyClaimsScreen({super.key});

  @override
  ConsumerState<MyClaimsScreen> createState() => MyClaimsScreenState();
}

class MyClaimsScreenState extends ConsumerState<MyClaimsScreen> {
  List<Task> _claimedDonations = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadClaimedDonations();
  }

  /// Public method to refresh claims from outside
  void refresh() {
    _loadClaimedDonations();
  }

  Future<void> _loadClaimedDonations() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final apiService = ref.read(apiServiceProvider);
      final List<dynamic> data = await apiService.getNgoClaimedTasks();
      final donations = data.map((json) => Task.fromJson(json)).toList();
      if (mounted) {
        setState(() {
          _claimedDonations = donations;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        if (e.toString().contains('403') || e.toString().contains('Forbidden')) {
          setState(() {
            _claimedDonations = [];
            _isLoading = false;
          });
        } else {
          setState(() {
            _error = e.toString();
            _isLoading = false;
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Container(
            color: Colors.white,
            child: const TabBar(
              labelColor: Color(0xFF4CAF50),
              unselectedLabelColor: Colors.grey,
              indicatorColor: Color(0xFF4CAF50),
              tabs: [
                Tab(text: 'ACTIVE'),
                Tab(text: 'HISTORY'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _buildList(active: true),
                _buildList(active: false),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList({required bool active}) {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Color(0xFF4CAF50)),
            SizedBox(height: 16),
            Text('Loading your claims...'),
          ],
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              const Text(
                'Failed to load claims',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _loadClaimedDonations,
                icon: const Icon(Icons.refresh),
                label: const Text('RETRY'),
              ),
            ],
          ),
        ),
      );
    }

    final filteredDonations = _claimedDonations.where((d) {
      final isCompleted = d.status == TaskStatus.completed || d.status == TaskStatus.delivered || d.status == TaskStatus.cancelled;
      return active ? !isCompleted : isCompleted;
    }).toList();

    if (filteredDonations.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadClaimedDonations,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.1),
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    active ? Icons.shopping_basket_outlined : Icons.history,
                    size: 80,
                    color: Colors.grey.shade400,
                  ),
                  const SizedBox(height: 16),
                   Text(
                    active ? 'No Active Claims' : 'No History Yet',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    active
                        ? 'Claim donations from the Available tab\nto see them here'
                        : 'Completed pickups will appear here',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey.shade500),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadClaimedDonations,
      child: Column(
        children: [
          if (active) _buildMonthlySummary(filteredDonations),

          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: filteredDonations.length,
              itemBuilder: (context, index) {
                final donation = filteredDonations[index];
                return ClaimedDonationCard(
                  task: donation,
                  onShowQr: active ? () => _showQrCode(donation, active) : null,
                  showTime: true,
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMonthlySummary(List<Task> donations) {
    final now = DateTime.now();
    final monthlyClaims = donations.where((d) {
      return d.createdAt.month == now.month && d.createdAt.year == now.year;
    }).toList();

    final monthName = DateFormat('MMMM yyyy').format(now);
    final totalQuantity =
        monthlyClaims.fold<double>(0, (sum, d) => sum + d.quantityKg);

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
        ),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.green.withValues(alpha: 0.3),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.calendar_month, color: Colors.white70, size: 16),
              const SizedBox(width: 8),
              Text(
                'Active Claims Overview ($monthName)',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ],
          ),
          const Divider(color: Colors.white24, height: 24),
          Row(
            children: [
              const Icon(Icons.inventory_2, color: Colors.white, size: 40),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Claims',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    Text(
                      '${monthlyClaims.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'To Collect',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  Text(
                    '${totalQuantity.toStringAsFixed(1)} kg',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      );
  }

  void _showQrCode(Task donation, bool isActive) {
    showDialog(
      context: context,
      builder: (context) => QrCodeDialog(
        donationId: donation.id,
        qrData: donation.deliveryToken ?? donation.id,
        donorName: donation.donorName,
        onVerify: isActive ? () => _verifyDonation(donation.id) : null,
      ),
    );
  }

  Future<void> _verifyDonation(String donationId) async {
    try {
      final apiService = ref.read(apiServiceProvider);
      await apiService.verifyTaskReceipt(donationId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Verification Successful! Moved to History.'),
          backgroundColor: Colors.green,
        ));
      }
      _loadClaimedDonations();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Verification failed: $e'),
          backgroundColor: Colors.red,
        ));
      }
    }
  }
}
