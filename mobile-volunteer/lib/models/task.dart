/// Task model matching backend schema
enum TaskStatus {
  pending,
  assigned,
  accepted,
  pickedUp,
  inTransit,
  delivered,
  cancelled,
  completed
}

enum FoodType { veg, nonVeg, vegan, mixed, snack, other }

class Task {
  final String id;
  final String donorId;
  final String donorName;
  final String? ngoId;
  final String? volunteerId;
  final double pickupLat;
  final double pickupLng;
  final String pickupAddress;
  final double? dropLat;
  final double? dropLng;
  final FoodType foodType;
  final double quantityKg;
  final String? description;
  final bool requiresCooling;
  final DateTime? expiryTime;
  final TaskStatus status;
  final String? pickupToken;
  final String? deliveryToken;
  final DateTime createdAt;

  Task({
    required this.id,
    required this.donorId,
    this.donorName = 'Unknown Donor',
    this.ngoId,
    this.volunteerId,
    required this.pickupLat,
    required this.pickupLng,
    this.pickupAddress = 'Address not provided',
    this.dropLat,
    this.dropLng,
    required this.foodType,
    required this.quantityKg,
    this.description,
    this.requiresCooling = false,
    this.expiryTime,
    required this.status,
    this.pickupToken,
    this.deliveryToken,
    required this.createdAt,
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json['id'] ?? '',
      donorId: json['donor_id'] ?? '',
      donorName: json['donor_name'] ?? 'Unknown Donor',
      ngoId: json['ngo_id'],
      volunteerId: json['volunteer_id'],
      pickupLat: (json['pickup_lat'] ?? 0).toDouble(),
      pickupLng: (json['pickup_lng'] ?? 0).toDouble(),
      pickupAddress: json['pickup_address'] ?? 'Address not provided',
      dropLat: json['drop_lat']?.toDouble(),
      dropLng: json['drop_lng']?.toDouble(),
      foodType: _parseFoodType(json['food_type']),
      quantityKg: (json['quantity_kg'] ?? 0).toDouble(),
      description: json['description'],
      requiresCooling: json['requires_cooling'] ?? false,
      expiryTime: json['expiry_time'] != null
          ? DateTime.parse(json['expiry_time'])
          : null,
      status: _parseStatus(json['status']),
      pickupToken: json['pickup_token'],
      deliveryToken: json['delivery_token'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

  static TaskStatus _parseStatus(String? status) {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return TaskStatus.pending;
      case 'ASSIGNED':
        return TaskStatus.assigned;
      case 'ACCEPTED':
        return TaskStatus.accepted;
      case 'PICKED_UP':
        return TaskStatus.pickedUp;
      case 'IN_TRANSIT':
        return TaskStatus.inTransit;
      case 'DELIVERED':
        return TaskStatus.delivered;
      case 'CANCELLED':
        return TaskStatus.cancelled;
      case 'COMPLETED':
        return TaskStatus.completed;
      default:
        return TaskStatus.pending;
    }
  }

  static FoodType _parseFoodType(String? type) {
    switch (type?.toUpperCase()) {
      case 'VEG':
        return FoodType.veg;
      case 'NON_VEG':
      case 'NON-VEG':
        return FoodType.nonVeg;
      case 'VEGAN':
        return FoodType.vegan;
      case 'MIXED':
        return FoodType.mixed;
      case 'SNACK':
        return FoodType.snack;
      default:
        return FoodType.other;
    }
  }

  // Helper to convert to usage string (for API calls)
  String get foodTypeString {
    switch (foodType) {
      case FoodType.veg: return 'VEG';
      case FoodType.nonVeg: return 'NON_VEG';
      case FoodType.vegan: return 'VEGAN';
      case FoodType.mixed: return 'MIXED';
      case FoodType.snack: return 'SNACK';
      default: return 'MIXED';
    }
  }
}
