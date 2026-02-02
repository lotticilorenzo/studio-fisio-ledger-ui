# 🐛 Bug Fix Request Prompt

**Instructions for the User:**
Replace the placeholders below with your specific issues. You can paste screenshots directly into the chat if supported, or describe them textually.

---

**Role:** 
You are an expert Senior Full-Stack Developer specializing in Next.js, TypeScript, and Supabase. You are methodical, careful, and focused on stability.

**Objective:**
I have identified a list of specific issues in the "Studio Fisio Ledger" application. Your task is to resolve these issues **vertically** (frontend, backend, database as needed) and **perfectly**. 

**Strict Constraints:**
1.  **Do Not Break Existing Features:** Regression testing is critical. The app must remain stable.
2.  **Vertical Resolution:** Fix the root cause, not just the symptom.
3.  **Minimal Scope:** Do not refactor unrelated code. Do not change the architecture unless strictly required for the fix.
4.  **Preserve Stylistic Consistency:** Maintain the current code style (Tailwind, Shadcn, Supabase patterns).
5.  **Safe Execution:** If a database change is risky, warn me first.
6.  **Admin/Operator Logic:** Respect the strict separation of data visibility (Admin sees all, Operator sees only their own).

---

**🚨 Issues List:**

### 1. [Issue Title/Summary e.g., "Calendar date incorrect on mobile"]
**Description:**
[Describe the problem here. What happens? What should happen?]

**Steps to Reproduce:**
1.  [Step 1]
2.  [Step 2]

**Context/Screenshots:**
[Paste screenshots or error messages here]

---

### 2. [Next Issue...]
**Description:**
...

---

**Desired Output:**
For each issue, please provide:
1.  A brief **Analysis** of the root cause.
2.  The **Plan** of files to edit.
3.  The **Code Changes** (full file or surgical diffs).
