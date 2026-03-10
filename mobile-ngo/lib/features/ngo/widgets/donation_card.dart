import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../models/task.dart';

/// Reusable donation card widget
/// Displays donation information and claim button
class DonationCard extends StatelessWidget {
  final Task task;
  final VoidCallback onClaim;
  final bool isLoading;

  const DonationCard({
    super.key,
    required this.task,
    required this.onClaim,
    this.isLoading = false,
  });

  Color _getFoodTypeColor(FoodType foodType) {
    switch (foodType) {
      case FoodType.veg:
        return Colors.green;
      case FoodType.nonVeg:
        return Colors.red;
      case FoodType.vegan:
        return Colors.teal;
      case FoodType.mixed:
        return Colors.orange;
      case FoodType.snack:
        return Colors.purple;
      default:
        return Colors.grey;
    }
  }

  String _formatExpiryTime(DateTime? expiryTime) {
    if (expiryTime == null) return 'No expiry';
    
    final now = DateTime.now();
    final difference = expiryTime.difference(now);
    
    if (difference.isNegative) {
      return 'Expired';
    } else if (difference.inHours < 1) {
      return 'Expires in ${difference.inMinutes} minutes';
    } else if (difference.inHours < 24) {
      return 'Expires in ${difference.inHours} hours';
    } else {
      return 'Expires on ${DateFormat('MMM dd, hh:mm a').format(expiryTime)}';
    }
  }

  @override
  Widget build(BuildContext context) {
    final expiryTime = task.expiryTime;
    final isExpired = expiryTime != null && expiryTime.isBefore(DateTime.now());
    final isExpiringSoon = !isExpired && expiryTime != null && expiryTime.difference(DateTime.now()).inHours < 2;
    final expiryText = _formatExpiryTime(expiryTime);

    final donorName = task.donorName; 
    final address = task.pickupAddress; 

    return Card(
      elevation: 3,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    donorName, 
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _getFoodTypeColor(task.foodType),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    task.foodTypeString,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            
            Row(
              children: [
                const Icon(Icons.restaurant, size: 20, color: Colors.grey),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Quantity: ${task.quantityKg.toStringAsFixed(1)} kg',
                    style: const TextStyle(fontSize: 16),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.location_on, size: 20, color: Colors.grey),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    address,
                    style: const TextStyle(fontSize: 14, color: Colors.black87),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            
            Row(
              children: [
                Icon(
                  Icons.access_time,
                  size: 20,
                  color: isExpiringSoon ? Colors.red : Colors.grey,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    expiryText,
                    style: TextStyle(
                      fontSize: 14,
                      color: isExpiringSoon ? Colors.red : Colors.black87,
                      fontWeight: isExpiringSoon ? FontWeight.bold : FontWeight.normal,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: (isLoading || isExpired) ? null : onClaim,
                style: ElevatedButton.styleFrom(
                  backgroundColor: isExpired ? Colors.grey : const Color(0xFF4CAF50),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : Text(
                        isExpired ? 'EXPIRED' : 'CLAIM',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
