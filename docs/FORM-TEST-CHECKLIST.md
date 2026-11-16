# Report Form – Team Test Checklist

For the **Form interaction** card. Every team member does this once on the
published site, then adds their feedback to the card's Note so the team can
discuss improvements next sprint.

Use **fake** details only. The contact email is shown to anyone who clicks
the item.

## Steps
1. Open the published site and click **Report an Item**.
2. Submit a fake **lost** item:
   - Report type: *I lost something*
   - Item name, location, date, description: anything made up
   - Photo: attach any picture (for example, a photo of a mug)
   - Contact email: a fake one, such as `test@example.com`
3. Check that the form closes and your item appears under **Recent Items**
   with its photo.
4. Open the shared Google Sheet and confirm your row is there, including a
   Photo URL that opens your picture.
5. Accessibility checks:
   - [ ] Open the form and fill it in using only the keyboard (Tab,
         Shift+Tab, arrow keys, Enter). The highlighted field is always
         visible.
   - [ ] Press Esc. The form closes.
   - [ ] Click Submit with empty fields. You are told which fields are
         missing.
   - [ ] Try it on a phone. Fields are easy to tap and read.

## Feedback to copy into the card's Note
```
Name:
Date tested:
Device / browser:
Fake item submitted (name):
Showed on site?  Yes / No
Showed in Sheet? Yes / No
Photo worked?    Yes / No
What was confusing or hard to use:
Suggested improvement for next sprint:
```
