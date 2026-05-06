.PHONY: help test test-backend test-frontend security audit-fix

help:
	@echo "Available targets:"
	@echo "  test            Run all Jest tests"
	@echo "  test-backend    Run backend tests only"
	@echo "  test-frontend   Run frontend tests only"
	@echo "  security        Run npm audit (fails on moderate+ vulnerabilities)"
	@echo "  audit-fix       Auto-fix audit vulnerabilities where possible"

test:
	npm test

test-backend:
	npm run test:backend

test-frontend:
	npm run test:frontend

security:
	npm audit --audit-level=moderate

audit-fix:
	npm audit fix
