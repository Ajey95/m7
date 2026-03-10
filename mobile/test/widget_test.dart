import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:food_rescue_app/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: FoodRescueApp()));

    // Verify that the splash screen shows up
    expect(find.text('Food Rescue'), findsOneWidget);
  });
}
