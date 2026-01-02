# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - heading "Fantasy Football AI" [level=1] [ref=e7]
          - generic [ref=e8]:
            - generic [ref=e9]: First User
            - button "Logout" [ref=e10] [cursor=pointer]
        - navigation [ref=e11]:
          - link "My Leagues" [ref=e12] [cursor=pointer]:
            - /url: /dashboard
          - link "Trades" [ref=e13] [cursor=pointer]:
            - /url: /dashboard/trades
          - link "Waivers" [ref=e14] [cursor=pointer]:
            - /url: /dashboard/waivers
          - link "Injuries" [ref=e15] [cursor=pointer]:
            - /url: /dashboard/injuries
    - main [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]:
          - heading "My Leagues" [level=1] [ref=e19]
          - button "Connect League" [ref=e20] [cursor=pointer]
        - generic [ref=e21]:
          - img [ref=e23]
          - heading "No leagues connected" [level=3] [ref=e25]
          - paragraph [ref=e26]: Connect your fantasy football league to get AI-powered trade recommendations, waiver wire insights, and injury alerts.
          - button "Connect Your First League" [ref=e27] [cursor=pointer]
  - alert [ref=e28]
```