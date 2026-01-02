# Page snapshot

```yaml
- generic [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - heading "Fantasy Football AI" [level=1] [ref=e8]
          - generic [ref=e9]:
            - generic [ref=e10]: Test User
            - button "Logout" [ref=e11] [cursor=pointer]
        - navigation [ref=e12]:
          - link "My Leagues" [ref=e13] [cursor=pointer]:
            - /url: /dashboard
          - link "Trades" [active] [ref=e14] [cursor=pointer]:
            - /url: /dashboard/trades
          - link "Waivers" [ref=e15] [cursor=pointer]:
            - /url: /dashboard/waivers
          - link "Injuries" [ref=e16] [cursor=pointer]:
            - /url: /dashboard/injuries
    - main [ref=e17]:
      - generic [ref=e18]:
        - heading "No leagues connected" [level=3] [ref=e19]
        - paragraph [ref=e20]: Please connect a league to view trade recommendations.
        - link "Connect League" [ref=e21] [cursor=pointer]:
          - /url: /dashboard
```