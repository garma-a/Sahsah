import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';

/// Body of `GET /api/health`, matching the web frontend's `HealthResponse`.
class HealthResponse {
  const HealthResponse({required this.status, required this.service});

  factory HealthResponse.fromJson(Map<String, dynamic> json) {
    return HealthResponse(
      status: json['status'] as String? ?? '',
      service: json['service'] as String? ?? '',
    );
  }

  final String status;
  final String service;

  bool get isOk => status == 'ok';
}

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// HTTP client for the Sahsah NestJS backend shared with the web app.
class SahsahApi {
  SahsahApi({
    http.Client? client,
    String? baseUrl,
    this.timeout = const Duration(seconds: 5),
  }) : _client = client ?? http.Client(),
       _baseUrl = (baseUrl ?? AppConfig.apiBaseUrl).replaceFirst(
         RegExp(r'/+$'),
         '',
       );

  final http.Client _client;
  final String _baseUrl;
  final Duration timeout;

  String get baseUrl => _baseUrl;

  Future<HealthResponse> getHealth() async {
    final json = await _getJson('/health');
    return HealthResponse.fromJson(json);
  }

  Future<Map<String, dynamic>> _getJson(String path) async {
    final http.Response response;
    try {
      response = await _client
          .get(
            Uri.parse('$_baseUrl$path'),
            headers: const {'Accept': 'application/json'},
          )
          .timeout(timeout);
    } on TimeoutException {
      throw const ApiException('Request timed out');
    } on http.ClientException catch (error) {
      throw ApiException(error.message);
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        'Request to $path failed',
        statusCode: response.statusCode,
      );
    }

    // Decode as UTF-8 explicitly; the backend may omit the charset.
    final Object? body;
    try {
      body = jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      throw ApiException(
        'Invalid JSON from $path',
        statusCode: response.statusCode,
      );
    }
    if (body is! Map<String, dynamic>) {
      throw ApiException(
        'Unexpected response from $path',
        statusCode: response.statusCode,
      );
    }
    return body;
  }

  void close() => _client.close();
}
