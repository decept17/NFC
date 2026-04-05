"""
conftest.py — Shared pytest configuration for the NFC API test suite.

Registers custom markers so pytest does not emit warnings when
integration tests are collected but the test_db service is not running.

Usage:
  # Phase 1 & 3 unit tests only (no Docker needed):
  pytest tests/ -m "not integration" -v

  # Phase 2 integration tests (requires test_db Docker service):
  docker-compose --profile testing up -d test_db
  pytest tests/test_integration.py -m integration -v

  # All tests:
  pytest tests/ -v
"""


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "integration: marks tests that require a live PostgreSQL test_db service "
        "(deselect with '-m \"not integration\"')"
    )
