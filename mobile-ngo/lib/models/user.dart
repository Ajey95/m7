/// User model with role-based enum
enum UserRole { donor, volunteer, ngo, dispatcher, admin }

class User {
  final String id;
  final String email;
  final String fullName;
  final String? phoneNumber;
  final UserRole role;
  final bool isActive;
  final String? profileImage;

  User({
    required this.id,
    required this.email,
    required this.fullName,
    this.phoneNumber,
    required this.role,
    this.isActive = true,
    this.profileImage,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      fullName: json['full_name'] ?? '',
      phoneNumber: json['phone_number'],
      role: _parseRole(json['role']),
      isActive: json['is_active'] ?? true,
      profileImage: json['profile_image'],
    );
  }

  static UserRole _parseRole(String? role) {
    switch (role?.toLowerCase()) {
      case 'donor':
        return UserRole.donor;
      case 'volunteer':
        return UserRole.volunteer;
      case 'ngo':
        return UserRole.ngo;
      case 'dispatcher':
        return UserRole.dispatcher;
      case 'admin':
        return UserRole.admin;
      default:
        return UserRole.donor;
    }
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'full_name': fullName,
        'phone_number': phoneNumber,
        'role': role.name,
        'is_active': isActive,
        'profile_image': profileImage,
      };
}
