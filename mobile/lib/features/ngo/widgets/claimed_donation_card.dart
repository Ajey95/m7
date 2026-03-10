import 'package:flutter/material.dart';
import '../../../../models/task.dart';

/// Card widget for displaying claimed donations
/// Shows donation info with status and QR code option
class ClaimedDonationCard extends StatelessWidget {
  final Task task;
  final VoidCallback? onShowQr;
  final bool showTime;

  const ClaimedDonationCard({
    super.key,
    required this.task,
    this.onShowQr,
    this.showTime = true,
  });

  Color _getFoodTypeColor(FoodType type) {
    switch (type) {
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

  @override
  Widget build(BuildContext context) {
    // Determine status color and text
    Color statusColor;
    String statusText;
    
    switch (task.status) {
      case TaskStatus.pending:
        statusColor = Colors.orange;
        statusText = 'Pending Pickup';
        break;
      case TaskStatus.assigned:
        statusColor = Colors.blue;
        statusText = 'Volunteer Assigned';
        break;
      case TaskStatus.pickedUp: // Map pickedUp to IN_TRANSIT visually or kept explicit
      case TaskStatus.inTransit:
        statusColor = Colors.purple;
        statusText = 'On the Way';
        break;
      case TaskStatus.delivered:
      case TaskStatus.completed: // We mapped completed to delivered in Task.dart but backend uses COMPLETED
        statusColor = Colors.green;
        statusText = 'Completed';
        break;
      case TaskStatus.cancelled:
        statusColor = Colors.red;
        statusText = 'Cancelled';
        break;
      default:
        statusColor = Colors.grey;
        statusText = task.status.toString().split('.').last;
    }

    // Use safe fields
    final donorName = task.donorName; 
    final address = task.pickupAddress; 

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row
            Row(
              children: [
                // Food Type Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getFoodTypeColor(task.foodType),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    task.foodTypeString,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Status Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: statusColor.withOpacity(0.5)),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: statusColor,
                    ),
                  ),
                ),
                const Spacer(),
                // Quantity
                Text(
                  '${task.quantityKg} kg',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF4CAF50),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Donor Name
            Row(
              children: [
                const Icon(Icons.store, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    donorName,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),

            // Address (Pickup Location)
            Row(
              children: [
                const Icon(Icons.location_on, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    'Pickup: $address',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Description
            if (task.description != null && task.description!.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  task.description!,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade700,
                  ),
                ),
              ),

            const SizedBox(height: 12),

            // Time & QR Button
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (showTime)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                         const Text(
                          '🕒 Created at',
                          style: TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                        Text(
                          _formatDate(task.createdAt),
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey.shade800,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                if (!showTime) const Spacer(), // Push QR button to right if time is hidden
                
                if (onShowQr != null) ...[
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    onPressed: onShowQr,
                    icon: const Icon(Icons.qr_code, size: 18),
                    label: const Text('Show QR'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4CAF50),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap, // Reduces minimum size constraints
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'N/A';
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}
