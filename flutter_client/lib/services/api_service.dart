import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/language.dart';
import '../models/request.dart';
import '../models/session.dart';

class ApiService {
  // Configurable base URL. Default pointing to local backend / reverse proxy
  static const String defaultBaseUrl = 'http://10.0.2.2:3000/api/v1'; // Android emulator alias to host
  final String baseUrl;

  ApiService({this.baseUrl = defaultBaseUrl});

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
  };

  Future<List<SupportedLanguage>> fetchLanguages() async {
    final response = await http.get(Uri.parse('$baseUrl/languages'), headers: _headers);
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List list = data['languages'] as List;
      return list.map((e) => SupportedLanguage.fromJson(e)).toList();
    } else {
      throw Exception('Failed to load supported language catalog: ${response.statusCode}');
    }
  }

  Future<List<InterpretationRequest>> fetchClientRequests() async {
    final response = await http.get(Uri.parse('$baseUrl/requests'), headers: _headers);
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List list = data['requests'] as List;
      return list.map((e) => InterpretationRequest.fromJson(e)).toList();
    } else {
      throw Exception('Failed to load interpretation requests: ${response.statusCode}');
    }
  }

  Future<InterpretationRequest> createRequest({
    String? sourceLanguage,
    required String targetLanguage,
    bool isUnknownLanguage = false,
    String? unknownLanguageNotes,
    required String serviceCategory,
    required String urgency,
    required String modality,
    required String scheduleType,
    String? scheduledTime,
    required String minRoutingContext,
  }) async {
    final body = json.encode({
      'sourceLanguage': isUnknownLanguage ? 'unknown' : sourceLanguage,
      'targetLanguage': targetLanguage,
      'isUnknownLanguage': isUnknownLanguage,
      'unknownLanguageNotes': unknownLanguageNotes,
      'serviceCategory': serviceCategory,
      'urgency': urgency,
      'modality': modality,
      'scheduleType': scheduleType,
      'scheduledTime': scheduledTime,
      'minRoutingContext': minRoutingContext,
    });

    final response = await http.post(
      Uri.parse('$baseUrl/requests'),
      headers: _headers,
      body: body,
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      final data = json.decode(response.body);
      return InterpretationRequest.fromJson(data['request']);
    } else {
      final err = json.decode(response.body);
      throw Exception(err['error'] ?? 'Failed to submit interpretation request');
    }
  }

  Future<void> cancelRequest(String reference, String reason) async {
    final response = await http.post(
      Uri.parse('$baseUrl/requests/$reference/cancel'),
      headers: _headers,
      body: json.encode({'reason': reason}),
    );
    if (response.statusCode != 200) {
      final err = json.decode(response.body);
      throw Exception(err['error'] ?? 'Failed to cancel request');
    }
  }

  Future<InterpretationSession> fetchSession(String sessionId) async {
    final response = await http.get(Uri.parse('$baseUrl/sessions/$sessionId'), headers: _headers);
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return InterpretationSession.fromJson(data['session']);
    } else {
      throw Exception('Failed to retrieve session: ${response.statusCode}');
    }
  }

  Future<void> endSession(String sessionId) async {
    await http.post(Uri.parse('$baseUrl/sessions/$sessionId/end'), headers: _headers);
  }

  Future<void> submitFeedback(String sessionId, int rating, String? comment) async {
    await http.post(
      Uri.parse('$baseUrl/feedback'),
      headers: _headers,
      body: json.encode({
        'sessionId': sessionId,
        'rating': rating,
        'comment': comment,
      }),
    );
  }
}
