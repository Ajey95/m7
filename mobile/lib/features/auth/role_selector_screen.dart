import 'package:flutter/material.dart';

/// Role selector for users who haven't selected a role yet
class RoleSelectorScreen extends StatelessWidget {
  const RoleSelectorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 48),
              const Text(
                'Choose Your Role',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'How would you like to contribute?',
                style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              Expanded(
                child: Column(
                  children: [
                    _RoleOption(
                      icon: Icons.food_bank,
                      title: 'Donor',
                      description: 'Donate surplus food from your restaurant, hotel, or event',
                      color: const Color(0xFF4CAF50),
                      onTap: () {
                        Navigator.pushReplacementNamed(context, '/donor-home');
                      },
                    ),
                    const SizedBox(height: 16),
                      _RoleOption(
                        icon: Icons.delivery_dining,
                        title: 'Volunteer',
                        description: 'Pick up and deliver food donations to those in need',
                        color: const Color(0xFF2196F3),
                        onTap: () {
                          Navigator.pushReplacementNamed(context, '/volunteer-home');
                        },
                      ),
                      const SizedBox(height: 16),
                      _RoleOption(
                        icon: Icons.business,
                        title: 'NGO',
                        description: 'Claim food donations for your organization',
                        color: const Color(0xFFFF9800),
                        onTap: () {
                          Navigator.pushReplacementNamed(context, '/ngo-home');
                        },
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final Color color;
  final VoidCallback onTap;

  const _RoleOption({
    required this.icon,
    required this.title,
    required this.description,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, size: 32, color: Colors.white),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, color: color),
          ],
        ),
      ),
    );
  }
}
