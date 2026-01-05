# Page snapshot

```yaml
- generic [ref=e3]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e5]:
    - generic [ref=e6]:
      - img [ref=e8]
      - heading "Admin Portal" [level=3] [ref=e10]
      - paragraph [ref=e11]: Sign in to access the admin panel
    - generic [ref=e13]:
      - generic [ref=e14]:
        - text: Email
        - textbox "Email" [ref=e15]:
          - /placeholder: admin@example.com
      - generic [ref=e16]:
        - text: Password
        - textbox "Password" [ref=e17]:
          - /placeholder: ••••••••
      - button "Sign In" [ref=e18] [cursor=pointer]
      - generic [ref=e19]:
        - button "Forgot password?" [ref=e20] [cursor=pointer]
        - button "Back to home" [ref=e21] [cursor=pointer]
```