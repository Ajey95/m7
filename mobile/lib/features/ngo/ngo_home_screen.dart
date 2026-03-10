import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../main.dart';
import 'ngo_claiming_screen.dart';
import 'my_claims_screen.dart';
import 'ngo_profile_screen.dart';

/// Main dashboard for NGO users
/// Tabs: Available Donations | My Claims | Profile
class NgoHomeScreen extends ConsumerStatefulWidget {
  const NgoHomeScreen({super.key});

  @override
  ConsumerState<NgoHomeScreen> createState() => _NgoHomeScreenState();
}

class _NgoHomeScreenState extends ConsumerState<NgoHomeScreen> {
  int _currentIndex = 0;
  String _ngoName = 'Loading...';
  String _verificationStatus = 'PENDING'; // Track verification status
  int _claimsCount = 0;
  final GlobalKey<MyClaimsScreenState> _myClaimsKey = GlobalKey<MyClaimsScreenState>();

  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = [
      NgoClaimingScreen(showAppBar: false, onClaimSuccess: _onClaimSuccess),
      MyClaimsScreen(key: _myClaimsKey),
      const NgoProfileScreen(),
    ];
    _loadNgoInfo();
    _loadClaimsCount();
  }

  /// Called when a donation is successfully claimed
  void _onClaimSuccess() {
    _loadClaimsCount();
    // Refresh the My Claims screen
    _myClaimsKey.currentState?.refresh();
  }

  Future<void> _loadClaimsCount() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      final claims = await apiService.getNgoClaimedTasks();
      if (mounted) {
        setState(() {
          _claimsCount = claims.length;
        });
      }
    } catch (e) {
      print('Error loading claims count: $e');
      // If error (e.g. 403 Pending), just show 0 claims
      if (mounted) {
        setState(() {
          _claimsCount = 0;
        });
      }
    }
  }

  Future<void> _loadNgoInfo() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      final ngoInfo = await apiService.getNgoProfile();
      if (mounted) {
        setState(() {
          _ngoName = ngoInfo['organization_name'] ?? 'NGO Dashboard';
          _verificationStatus = (ngoInfo['verification_status'] ?? 'PENDING').toString().toUpperCase();
        });
      }
    } catch (e) {
      print('Error loading NGO info: $e');
      if (mounted) {
        setState(() {
          _ngoName = 'Food Rescue NGO';
        });
      }
    }
  }

  String _getSubtitle() {
    switch (_currentIndex) {
      case 0:
        return 'Available Donations';
      case 1:
        return 'My Claims';
      case 2:
        return 'NGO Profile';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    // Show verification pending screen if NGO is not yet verified
    if (_verificationStatus == 'PENDING' || _verificationStatus == 'REJECTED') {
      final isRejected = _verificationStatus == 'REJECTED';
      
      return Scaffold(
        appBar: AppBar(
          title: Text(_ngoName),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _loadNgoInfo,
              tooltip: 'Check Status',
            ),
            IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () => _showLogoutDialog(),
              tooltip: 'Logout',
            ),
          ],
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: isRejected ? Colors.red.shade100 : Colors.orange.shade100,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isRejected ? Icons.block : Icons.hourglass_empty,
                    size: 50,
                    color: isRejected ? Colors.red.shade700 : Colors.orange.shade700,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  isRejected ? 'Application Rejected' : 'Verification Pending',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  isRejected 
                      ? 'Your NGO application has been rejected by the administrator. Please contact support for more information.'
                      : 'Your NGO account is under review by the admin. You will be able to access all features once your account is verified.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey[600],
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 32),
                OutlinedButton.icon(
                  onPressed: _loadNgoInfo,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Check Verification Status'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _ngoName,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              _getSubtitle(),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.normal,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() {});
              if (_currentIndex == 0) {
                 // Trigger refresh on claiming screen if possible,
                 // or just rely on the screen's own refresh logic
              }
            },
            tooltip: 'Refresh',
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => _showLogoutDialog(),
            tooltip: 'Logout',
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
          if (index == 1) {
            _loadClaimsCount(); // Refresh count when switching to claims
            _myClaimsKey.currentState?.refresh(); // Refresh the claims list
          }
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.restaurant_menu_outlined),
            selectedIcon: Icon(Icons.restaurant_menu),
            label: 'Available',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: _claimsCount > 0,
              label: Text('$_claimsCount'),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: _claimsCount > 0,
              label: Text('$_claimsCount'),
              child: const Icon(Icons.shopping_cart),
            ),
            label: 'My Claims',
          ),
          const NavigationDestination(
            icon: Icon(Icons.business_outlined),
            selectedIcon: Icon(Icons.business),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final apiService = ref.read(apiServiceProvider);
              await apiService.clearToken();
              if (mounted) {
                Navigator.pop(context); // Close dialog
                Navigator.pushReplacementNamed(context, '/'); // Go to login
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}
