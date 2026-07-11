#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "تحويل Ruaa من منصة صنّاع محتوى إلى وكالة تسويق رقمية + نظام تشغيل إبداعي. البداية: (أ) إصلاح تشغيل المشروع، (ب) Landing Page جديد للوكالة بشعار 'ندشن قصة حب جديدة مع عميلك'، (ج) إعادة هيكلة إلى Engines، ثم إضافة CRM، Content OS، Tasks، AI everywhere، Digital Twin، RBAC."

backend:
  - task: "Create /api/leads endpoint for landing page contact form"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added POST /api/leads (public, creates a lead doc with name/email/story/status='new') and GET /api/leads (super_admin only). Manual curl test succeeded returning {success:true,id:...}."
      - working: true
        agent: "testing"
        comment: "✅ ALL TESTS PASSED. POST /api/leads: (1) valid data returns 200 with {success:true, id:<uuid>}, (2) invalid email returns 422, (3) missing field returns 422. GET /api/leads: (4) no auth returns 401, (5) non-admin token returns 403 with detail='غير مصرح'. All validation and authorization working correctly."

  - task: "Verify all existing endpoints still work after adding leads"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "No changes to existing endpoints; only ADD of leads section before app.include_router(). Need regression sanity check on: auth/login, videos/feed, communities, teams, incubator, ai/assist."
      - working: true
        agent: "testing"
        comment: "✅ REGRESSION PASSED (7/8 endpoints). All critical endpoints working: auth/login ✅, auth/me ✅, videos/feed ✅, communities ✅ (10 seeded), teams ✅, incubator/stages ✅ (7 stages), explore/creators ✅. NOTE: ai/assist returns 500 due to EMERGENT_LLM_KEY budget exceeded (infrastructure issue, not code regression). No code regressions detected."

frontend:
  - task: "New Agency Landing Page at / (public, full-width, desktop responsive)"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Landing.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Built new Landing page with 8 sections: TopNav, Hero (slogan 'ندشن قصة حب جديدة مع عميلك'), Manifesto, Offer (4 services), LoveStories (3 case studies), Vision2030 (5-year roadmap), Principles (8), Contact form (POST /api/leads), Footer. Uses framer-motion for scroll animations. Full RTL, dark cinematic theme + electric yellow accent. Visually verified via screenshots — looks great."

  - task: "Route restructure: / = Landing, /feed = mobile app Feed"
    implemented: true
    working: "NA"
    file: "frontend/src/App.js, frontend/src/components/Layout.jsx, frontend/src/pages/Auth.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Updated App.js: / renders Landing (outside Layout), /feed renders Feed inside mobile Layout. Layout.isFeed check now uses /feed. Bottom nav Home NavItem points to /feed. Auth.jsx redirects to /feed after login. Verified /feed still renders correctly with bottom nav."

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 8
  run_ui: false

test_plan:
  current_focus:
    - "Create /api/leads endpoint for landing page contact form"
    - "Verify all existing endpoints still work after adding leads"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Iteration 7 (Sprint: Agency Rebrand). Delivered new agency Landing Page at / and backend /api/leads endpoint. All previous features intact. Please test: 1) POST /api/leads with valid + invalid body, 2) GET /api/leads without auth (should 401/403), 3) sanity: /auth/login, /videos/feed, /communities, /teams, /incubator/stages, /ai/assist still 200. No regressions expected. Use test2@test.com / testpass123 if that account still exists, else create fresh signup."
  - agent: "testing"
    message: "Iteration 7 testing COMPLETE. ✅ NEW /api/leads endpoint: All 5 tests passed (POST valid/invalid/missing, GET no-auth/non-admin). ✅ REGRESSION: 7/8 endpoints passed. Only ai/assist failed due to EMERGENT_LLM_KEY budget limit (infrastructure issue, not code bug). All critical backend functionality intact. Test report saved to /app/test_reports/iteration_7.json. Ready for main agent to summarize and finish."
