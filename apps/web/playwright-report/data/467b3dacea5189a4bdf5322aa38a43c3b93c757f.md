# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Get Started" [level=1] [ref=e5]
      - paragraph [ref=e6]: Create your account
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e9]: Name (optional)
        - textbox "Name (optional)" [ref=e10]:
          - /placeholder: John Doe
      - generic [ref=e11]:
        - generic [ref=e12]: Email
        - textbox "Email" [ref=e13]:
          - /placeholder: you@example.com
      - generic [ref=e14]:
        - generic [ref=e15]: Password
        - textbox "Password" [ref=e16]:
          - /placeholder: ••••••••
        - paragraph [ref=e17]: Minimum 8 characters
      - button "Create Account" [ref=e18] [cursor=pointer]
    - paragraph [ref=e19]:
      - text: Already have an account?
      - link "Sign in" [ref=e20] [cursor=pointer]:
        - /url: /login
  - alert [ref=e21]
```