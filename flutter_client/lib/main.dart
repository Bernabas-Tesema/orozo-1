import 'package:flutter/material.dart';
import 'screens/intake_screen.dart';
import 'screens/history_screen.dart';

void main() {
  runApp(const EthiopianInterpretationClientApp());
}

class EthiopianInterpretationClientApp extends StatelessWidget {
  const EthiopianInterpretationClientApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ELIP Client • የኢትዮጵያ ቋንቋዎች',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF046A38), // Ethiopian green
          primary: const Color(0xFF046A38),
          secondary: const Color(0xFFFCDD09), // Ethiopian gold/amber
          tertiary: const Color(0xFFDA121A), // Ethiopian red
          surface: Colors.white,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF046A38),
          foregroundColor: Colors.white,
          elevation: 0,
          centerTitle: false,
        ),
      ),
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    IntakeScreen(),
    HistoryScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.add_circle_outline),
            selectedIcon: Icon(Icons.add_circle, color: Color(0xFF046A38)),
            label: 'New Request',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history, color: Color(0xFF046A38)),
            label: 'Requests & Status',
          ),
        ],
      ),
    );
  }
}
