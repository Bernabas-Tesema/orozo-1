import 'package:flutter_test/flutter_test.dart';
import 'package:orzo_client/data/categories.dart';

void main() {
  test('intro categories match the orozo folders', () {
    expect(orzoCategories.map((category) => category.id), [
      'healthcare',
      'legal_court',
      'immigration',
      'public_services',
      'ngo_humanitarian',
      'education',
      'business',
    ]);
  });
}
