import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/models/peer_model.dart';

void main() {
  test('custom PC name is displayed without replacing connection ID', () {
    final client = Peer.fromJson({
      'id': '123456789',
      'alias': 'Cliente ABC - Recepção',
      'username': 'recepcao',
      'hostname': 'PC-001',
      'platform': 'Windows',
    });

    expect(client.getId(), 'Cliente ABC - Recepção');
    expect(client.id, '123456789');

    final restored = Peer.fromJson(client.toJson());
    expect(restored.alias, 'Cliente ABC - Recepção');
    expect(restored.id, '123456789');
  });

  test('client without an alias continues to show its original ID', () {
    final client = Peer.fromJson({
      'id': '987654321',
      'alias': '',
      'hostname': 'CLIENTE-WIN',
    });
    expect(client.getId(), '987654321');
    expect(client.id, '987654321');
  });
}
