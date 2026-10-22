import 'package:flutter/material.dart';

class LobbyScreen extends StatefulWidget {
  const LobbyScreen({super.key});

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  final _teamOne = TextEditingController(text: 'الفريق الأول');
  final _teamTwo = TextEditingController(text: 'الفريق الثاني');

  @override
  void dispose() {
    _teamOne.dispose();
    _teamTwo.dispose();
    super.dispose();
  }

  void _resetTeams() {
    setState(() {
      _teamOne.text = 'الفريق الأول';
      _teamTwo.text = 'الفريق الثاني';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('صحصح')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.all(24),
              children: [
                Text('جهّزوا الفريقين', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 12),
                const Text('النسخة الجديدة من اللعبة جاية قريب.'),
                const SizedBox(height: 32),
                TextField(
                  controller: _teamOne,
                  maxLength: 50,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(labelText: 'الفريق الأول'),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _teamTwo,
                  maxLength: 50,
                  decoration: const InputDecoration(labelText: 'الفريق الثاني'),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 24),
                Text(
                  '${_teamOne.text.isEmpty ? 'الفريق الأول' : _teamOne.text} × '
                  '${_teamTwo.text.isEmpty ? 'الفريق الثاني' : _teamTwo.text}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 24),
                OutlinedButton(onPressed: _resetTeams, child: const Text('إعادة الأسماء')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
