# Script to add reverse geocoding to NGO profile update

file_path = r'c:\Users\sister\Documents\SE-VOLUNTEER\final\mobile\lib\features\ngo\ngo_profile_screen.dart'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the updateNgoProfile section
old_code = '''      if (position != null) {
        final apiService = ref.read(apiServiceProvider);
        await apiService.updateNgoProfile(
          latitude: position.latitude,
          longitude: position.longitude,
        );'''

new_code = '''      if (position != null) {
        // Get address from coordinates using reverse geocoding
        String address = 'Location: ${position.latitude}, ${position.longitude}';
        try {
          final placemarks = await placemarkFromCoordinates(
            position.latitude,
            position.longitude,
          );
          if (placemarks.isNotEmpty) {
            final place = placemarks.first;
            address = '${place.street ?? ''}, ${place.locality ?? ''}, ${place.administrativeArea ?? ''}, ${place.country ?? ''}'.replaceAll(', ,', ',').trim();  # noqa: E501
            if (address.startsWith(',')) address = address.substring(1).trim();
            if (address.endsWith(',')) address = address.substring(0, address.length - 1).trim();
          }
        } catch (e) {
          print('Reverse geocoding failed: $e');
        }

        final apiService = ref.read(apiServiceProvider);
        await apiService.updateNgoProfile(
          latitude: position.latitude,
          longitude: position.longitude,
          address: address,
        );'''

content = content.replace(old_code, new_code)

# Also update the success message
content = content.replace(
    "content: Text('Location updated successfully!'),",
    "content: Text('Location and address updated!\\n$address'),"
)
content = content.replace(
    "const SnackBar(\n              content: Text('Location updated successfully!'),\n              backgroundColor: Colors.green,\n            ),",  # noqa: E501
    "SnackBar(\n              content: Text('Location and address updated!\\n$address'),\n              backgroundColor: Colors.green,\n              duration: const Duration(seconds: 3),\n            ),"  # noqa: E501
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("NGO profile screen updated with address geocoding!")
