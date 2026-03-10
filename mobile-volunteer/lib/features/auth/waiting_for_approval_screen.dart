import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/api_service.dart';
import '../../main.dart';

class WaitingForApprovalScreen extends ConsumerStatefulWidget {
  const WaitingForApprovalScreen({super.key});

  @override
  ConsumerState<WaitingForApprovalScreen> createState() =>
      _WaitingForApprovalScreenState();
}

class _WaitingForApprovalScreenState
    extends ConsumerState<WaitingForApprovalScreen> {
  Timer? _timer;
  String? _message;

  @override
  void initState() {
    super.initState();
    _message =
        'Your application has been submitted. Waiting for dispatcher approval...';
    // Poll volunteer profile every 5 seconds
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _checkStatus());
    // Also check immediately
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkStatus());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _checkStatus() async {
    try {
      final api = ref.read(apiServiceProvider);
      final profile = await api.getVolunteerProfile();
      if (profile != null && profile['id_verified'] == true) {
        _timer?.cancel();
        if (!mounted) return;
        // Approved -> navigate to volunteer home
        Navigator.pushReplacementNamed(context, '/volunteer-home');
      } else {
        setState(() {
          _message = 'Waiting for dispatcher to verify your ID...';
        });
      }
    } catch (e) {
      // If unauthorized or profile not available yet, keep waiting silently
      setState(() {
        _message = 'Waiting for dispatcher approval...';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Awaiting Approval'),
        automaticallyImplyLeading: false,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(height: 8),
              const CircularProgressIndicator(),
              const SizedBox(height: 24),
              Text(
                _message ?? '',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () async {
                  // Allow user to logout and return to login
                  final api = ref.read(apiServiceProvider);
                  await api.clearToken();
                  if (!mounted) return;
                  Navigator.pushNamedAndRemoveUntil(
                      context, '/login', (r) => false);
                },
                child: const Text('Return to Login'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
