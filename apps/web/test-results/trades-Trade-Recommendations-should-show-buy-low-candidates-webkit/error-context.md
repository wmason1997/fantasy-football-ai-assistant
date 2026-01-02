# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Welcome Back" [level=1] [ref=e5]
      - paragraph [ref=e6]: Sign in to your account
    - generic [ref=e7]:
      - generic [ref=e8]: Rate limit exceeded, retry in 1 minute
      - generic [ref=e9]:
        - generic [ref=e10]: Email
        - textbox "Email" [ref=e11]:
          - /placeholder: you@example.com
          - text: test@example.com
      - generic [ref=e12]:
        - generic [ref=e13]: Password
        - textbox "Password" [ref=e14]:
          - /placeholder: ••••••••
          - text: testpassword123
      - button "Sign In" [ref=e15] [cursor=pointer]
    - paragraph [ref=e16]:
      - text: Don't have an account?
      - link "Register" [ref=e17]:
        - /url: /register
  - alert [ref=e18]
```