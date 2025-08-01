# SQLite Migration Comprehensive Test Guide

## 📋 Overview

This document provides a complete testing framework for validating the SQLite migration from IndexedDB in the big-AGI application. Follow this guide to ensure all systems are working correctly before production deployment.

## 🚀 Quick Start

### Prerequisites
- Development server running (`npm run dev`)
- Access to `http://localhost:3000/sqlite-test`
- SQLite3 CLI tool installed (optional, for manual inspection)

### Test Environment Setup
1. **Clear Previous Data** (if needed)
   ```bash
   rm -f big-agi-*.db
   ```

2. **Start Fresh Testing Session**
   ```bash
   npm run dev
   ```

3. **Access Test Interface**
   - Navigate to: `http://localhost:3000/sqlite-test`
   - Open browser DevTools (F12) for detailed logging

## 🧪 Test Categories

### 1. Infrastructure Tests

#### 1.1 Database Creation Test
**Objective**: Verify SQLite databases are created automatically

**Steps**:
1. Access test interface
2. Click any test button
3. Check project root for database files

**Expected Results**:
```bash
ls -la *.db
# Should show:
# big-agi-data.db
# big-agi-chats.db  
# big-agi-llms.db (if LLM tests run)
```

**Validation**:
- [ ] Database files created with correct permissions
- [ ] No permission errors in console
- [ ] File sizes > 0 bytes

#### 1.2 API Endpoints Test
**Objective**: Verify all REST API endpoints respond correctly

**Manual API Testing** (using curl or browser):
```bash
# Test general stores API
curl http://localhost:3000/api/stores

# Test chats API
curl http://localhost:3000/api/chats

# Test LLMs API
curl http://localhost:3000/api/llms
```

**Expected Results**:
- HTTP 200 status codes
- Valid JSON responses
- Proper error handling for empty databases

**Validation**:
- [ ] All endpoints return valid JSON
- [ ] Error responses include helpful messages
- [ ] No 404 errors for valid endpoints

### 2. Store Operation Tests

#### 2.1 Device Store Test
**Purpose**: Test basic CRUD operations and auto-creation

**Test Steps**:
1. Click "Test Device Store" button
2. Observe test results in interface
3. Verify data persistence

**Expected Behavior**:
1. **First Run**: Store not found → Creates test data → Verifies creation
2. **Subsequent Runs**: Loads existing data → Shows stored information

**Validation Checklist**:
- [ ] Test completes without errors
- [ ] Device data contains browser information
- [ ] Data persists between page refreshes
- [ ] Timestamp shows when data was created

**Manual Verification**:
```bash
sqlite3 big-agi-data.db "SELECT * FROM stores WHERE name='app-device';"
```

#### 2.2 Custom Store Test
**Purpose**: Test dynamic store creation with arbitrary data

**Test Steps**:
1. Click "Test Custom Store" button
2. Enter custom store name and data
3. Verify store creation and listing

**Expected Results**:
- Store appears in "All Stores" listing
- Data structure preserved correctly
- Unique stores can be created

**Validation Checklist**:
- [ ] Custom store created successfully
- [ ] Data structure matches input
- [ ] Store visible in database listing
- [ ] No data corruption or type conversion issues

#### 2.3 Chat Operations Test
**Purpose**: Test conversation and message management

**Test Steps**:
1. Click "Create Test Conversation" button
2. Verify conversation creation
3. Test conversation deletion (if available)

**Expected Results**:
- Conversation created with proper structure
- Message fragments stored correctly
- Relational data maintained

**Deep Validation**:
```bash
# Check conversation structure
sqlite3 big-agi-chats.db "SELECT * FROM conversations LIMIT 1;"

# Check message structure  
sqlite3 big-agi-chats.db "SELECT * FROM messages LIMIT 1;"

# Check message fragments
sqlite3 big-agi-chats.db "SELECT * FROM message_fragments LIMIT 1;"
```

**Validation Checklist**:
- [ ] Conversation created with unique ID
- [ ] Message properly linked to conversation
- [ ] Text content stored in fragments
- [ ] Timestamps populated correctly
- [ ] Token counts initialized

#### 2.4 LLM Store Test
**Purpose**: Test AI model and service management

**Test Steps**:
1. Click "Generate Test LLM Data" button
2. Verify service and model creation
3. Check assignment relationships

**Expected Results**:
- Test services created (OpenAI, Anthropic, etc.)
- Test models linked to services
- Domain assignments configured

**Advanced Validation**:
```bash
# Check services
sqlite3 big-agi-llms.db "SELECT * FROM llm_services;"

# Check models
sqlite3 big-agi-llms.db "SELECT * FROM llm_models;"

# Check assignments
sqlite3 big-agi-llms.db "SELECT * FROM llm_assignments;"
```

**Validation Checklist**:
- [ ] Multiple services created
- [ ] Models properly linked to services
- [ ] Domain assignments configured
- [ ] Complex data structure preserved
- [ ] Foreign key relationships maintained

### 3. Performance Tests

#### 3.1 Response Time Test
**Objective**: Ensure operations complete within acceptable timeframes

**Benchmarks**:
- Store creation: < 100ms
- Data retrieval: < 50ms
- Complex queries: < 200ms

**Testing Method**:
1. Monitor browser DevTools Network tab
2. Record response times for each operation
3. Compare against benchmarks

**Validation**:
- [ ] All operations complete within timeframes
- [ ] No significant latency spikes
- [ ] Consistent performance across test runs

#### 3.2 Concurrent Operations Test
**Objective**: Test system stability under load

**Test Steps**:
1. Open multiple browser tabs with test interface
2. Run tests simultaneously across tabs
3. Verify data consistency

**Validation**:
- [ ] No database locks or conflicts
- [ ] Data remains consistent
- [ ] No corruption from concurrent access

### 4. Error Handling Tests

#### 4.1 Invalid Data Test
**Purpose**: Verify graceful handling of malformed data

**Test Cases**:
1. Send invalid JSON to APIs
2. Attempt to create stores with missing fields
3. Try to access non-existent stores

**Expected Behavior**:
- Proper HTTP error codes (400, 404, 500)
- Descriptive error messages
- System remains stable

**Manual Testing**:
```bash
# Test invalid JSON
curl -X POST http://localhost:3000/api/stores \
  -H "Content-Type: application/json" \
  -d '{"invalid": json}'

# Test missing fields
curl -X POST http://localhost:3000/api/stores \
  -H "Content-Type: application/json" \
  -d '{}'

# Test non-existent store
curl http://localhost:3000/api/stores/nonexistent
```

**Validation**:
- [ ] Appropriate error codes returned
- [ ] Error messages are helpful
- [ ] System doesn't crash on invalid input

#### 4.2 Database Recovery Test
**Purpose**: Test system behavior when database is unavailable

**Test Steps**:
1. Stop development server
2. Move database files temporarily
3. Restart server and test operations
4. Restore database files

**Expected Behavior**:
- New databases created automatically
- Graceful error messages
- System recovers when databases restored

**Validation**:
- [ ] Auto-recovery mechanisms work
- [ ] No permanent data loss
- [ ] Clear error reporting

### 5. Data Migration Tests

#### 5.1 IndexedDB to SQLite Migration
**Purpose**: Validate data transfer utilities

**Prerequisites**:
- Existing IndexedDB data (if available)
- Migration utilities accessible

**Test Steps**:
1. Export existing IndexedDB data
2. Run migration utilities
3. Verify data integrity after migration

**Validation**:
- [ ] All data transferred correctly
- [ ] No data corruption during migration
- [ ] Relationships preserved
- [ ] Performance improved post-migration

#### 5.2 Data Consistency Test
**Purpose**: Ensure migrated data maintains integrity

**Validation Methods**:
1. Compare record counts before/after
2. Verify key relationships maintained
3. Test functional operations with migrated data

**Validation**:
- [ ] Record counts match
- [ ] No orphaned records
- [ ] All features work with migrated data

## 🔍 Detailed Test Scenarios

### Scenario 1: First-Time User
**Objective**: Test experience for new user with no existing data

**Steps**:
1. Clear all database files
2. Access test interface
3. Run all tests in sequence
4. Verify clean state creation

**Expected Results**:
- All systems initialize correctly
- Default data created where appropriate
- No errors related to missing data

### Scenario 2: Existing User Migration
**Objective**: Test migration from existing IndexedDB data

**Steps**:
1. Load existing user data (if available)
2. Run migration utilities
3. Verify all functionality preserved
4. Test performance improvements

**Expected Results**:
- Complete data preservation
- Enhanced performance
- No functional regression

### Scenario 3: Power User Load Test
**Objective**: Test with large amounts of data

**Steps**:
1. Create multiple conversations with many messages
2. Add numerous LLM configurations
3. Test system performance and stability

**Expected Results**:
- System remains responsive
- Database operations scale properly
- No memory leaks or performance degradation

## 🐛 Troubleshooting Guide

### Common Issues and Solutions

#### Issue: "Failed to load LLM store"
**Symptoms**: 500 error when accessing LLM operations
**Causes**: 
- SQLite module import issues
- Database permissions
- File path problems

**Solutions**:
1. Restart development server
2. Check file permissions on database files
3. Verify SQLite dependencies installed
4. Check console for detailed error messages

#### Issue: "404 Not Found" for API endpoints
**Symptoms**: API calls return 404 errors
**Causes**:
- Development server not running
- Route configuration issues
- Next.js API route problems

**Solutions**:
1. Verify server is running on correct port
2. Check Next.js API route files exist
3. Restart development server
4. Check for TypeScript compilation errors

#### Issue: "Persistent storage is not supported"
**Symptoms**: Browser storage error messages
**Causes**:
- Client-side SQLite imports
- Middleware configuration issues
- Browser compatibility

**Solutions**:
1. Verify SQLite operations are server-side only
2. Check middleware configuration
3. Ensure proper SSR handling
4. Update browser if needed

#### Issue: Database file corruption
**Symptoms**: Invalid database errors, data loss
**Causes**:
- Concurrent access issues
- File system problems
- Improper shutdown

**Solutions**:
1. Stop development server
2. Remove corrupted database files
3. Restart server (databases will be recreated)
4. Restore from backup if available

### Debug Commands

```bash
# Check database integrity
sqlite3 big-agi-data.db "PRAGMA integrity_check;"

# View database schema
sqlite3 big-agi-data.db ".schema"

# Check database file info
file big-agi-data.db

# Monitor database operations (if available)
tail -f your-app.log | grep SQLite

# Check file permissions
ls -la *.db

# Test database connectivity
sqlite3 big-agi-data.db ".tables"
```

## 📊 Test Report Template

### Test Execution Summary
- **Date**: ___________
- **Tester**: ___________
- **Environment**: Development/Staging/Production
- **Browser**: ___________
- **Node Version**: ___________

### Test Results
| Test Category | Status | Notes |
|---------------|--------|-------|
| Infrastructure | ✅/❌ | |
| Device Store | ✅/❌ | |
| Custom Store | ✅/❌ | |
| Chat Operations | ✅/❌ | |
| LLM Store | ✅/❌ | |
| Performance | ✅/❌ | |
| Error Handling | ✅/❌ | |

### Performance Metrics
- **Store Creation Time**: _____ ms
- **Data Retrieval Time**: _____ ms
- **Complex Query Time**: _____ ms
- **Database Size**: _____ KB

### Issues Found
1. **Issue**: ___________
   **Severity**: High/Medium/Low
   **Status**: Open/Resolved
   **Notes**: ___________

### Recommendations
- [ ] Ready for production deployment
- [ ] Requires additional testing
- [ ] Performance optimization needed
- [ ] Bug fixes required

## 🎯 Pre-Production Checklist

### Technical Validation
- [ ] All test categories pass
- [ ] Performance meets benchmarks
- [ ] Error handling is robust
- [ ] Data migration tested
- [ ] Security considerations addressed

### User Experience Validation
- [ ] No functional regression
- [ ] Improved debugging capabilities
- [ ] Better error messages
- [ ] Enhanced monitoring available

### Deployment Readiness
- [ ] Backup procedures tested
- [ ] Rollback plan prepared
- [ ] Monitoring tools configured
- [ ] Documentation updated
- [ ] Team training completed

---

**Remember**: This test guide should be executed completely before any production deployment. Each test validates critical functionality that users depend on daily.

**Next Steps After Testing**: Once all tests pass, proceed with the store-by-store migration plan outlined in the main instructions.md document.