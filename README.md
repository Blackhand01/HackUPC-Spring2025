# OnlyFly: skip the stress, swap and rest (travel the world, swap your home)

## 1. Introduction

OnlyFly is the first AI-powered home-exchange platform that lets you travel the world while spending as little as possible. Our mission is simple: eliminate all accommodation costs except the flight, delivering authentic, personalized experiences.

**How it works**

1. **Sign up and list your home:**

   * Provide your property details, preferred destinations and available dates.
2. **Intelligent matching:**

   * Our advanced matching engine analyzes users’ preferences, personalities and interests to find the perfect home-exchange partner.
3. **Book the cheapest flight:**

   * By integrating Skyscanner’s API, OnlyFly recommends the most affordable flights on your chosen dates.
4. **Secure and easy payments:**

   * With Revolut’s API, manage deposits, virtual cards and automated payouts directly on the platform for total peace of mind.(WIP)
5. **Feedback and ranking:**

   * Leave reviews and receive ratings to build a trustworthy, vibrant community.

## 2. Purpose and Stakeholders

* **Traveler:** seeks simplicity in forming groups and choosing destinations.
* **System Administrator:** monitors performance metrics and oversees integrations.
* **API Sponsors (Skyscanner, Revolut, Grafana):** require well-defined integration workflows.

## 3. Vision and Objectives

* **Seamless UX:** one-click joins, intuitive interfaces.
* **Sustainability:** display CO₂ impact and green scores.
* **Collaborative Finance:** shared wallet and automatic expense splitting.
* **Operational Safety:** critical offline communication.
* **Data-Driven:** dashboards and alerts for performance and sustainability.

## 4. Key Features

1. **Registration & Profile:** OAuth/email, identity OCR, payment account.
2. **Travel Groups:** one-click invite links, mood/activity sliders.
3. **Destination Selection:** cards with flight cost, CO₂ estimate, recommended dates.
4. **Matching & Smart Swap:** interactive maps and real-time notifications.
5. **Booking & Wallet:** Skyscanner flights, Revolut wallet, automatic splitting and deposits.
6. **Critical Communications:** multilingual chat, Panic Button, P2P fallback.
7. **Follow-Up & Ratings:** calendar reminders, reviews, dispute management.
8. **Analytics & Dashboard:** host metrics, Grafana alerts, data export.

## 5. Stakeholder Requirements (SR)

### **SR1. Access and Authentication**  
- **SR1.1:** OAuth registration (Facebook/Google).  
- **SR1.2:** Email/SMS registration with code verification.  
- **SR1.3:** Email and phone verification.  
- **SR1.4:** Optional MFA support.  
- **SR1.5:** Document upload and OCR identity verification.  
- **SR1.6:** Instant group Revolut account creation and flight payment upon booking completion.

### **SR2. Profile and Accommodation Management**  
- **SR2.1:** CRUD for user profile.  
- **SR2.2:** CRUD for home details (photos, description, amenities, house rules).  
- **SR2.3:** Calculation and display of green score.

### **SR3. Group Creation and Management**  
- **SR3.1:** Generate/share one-click invitation links via WhatsApp/Telegram.  
- **SR3.2:** Simplified join via link without extra credentials.

### **SR4. Emotional Planning and Destinations**  
- **SR4.1:** Mood, activity, and duration selection via sliders.  
- **SR4.2:** Destination cards with evocative photos, estimated flight cost, CO₂ estimate, location, and recommended dates.

### **SR5. Advanced Matching and Smart Swap**  
- **SR5.1:** Display travel solutions on an interactive map with cost metrics and green scores.  
- **SR5.2:** Real-time push notifications for new match opportunities (Smart Swap).  
- **SR5.3:** Hybrid algorithm (ML + constraint rules on dates, budget, and preferences).

### **SR6. Booking, Shared Wallet, and Finance**  
- **SR6.1:** Skyscanner API integration for flight search and booking.  
- **SR6.2:** Automatic group wallet creation on Revolut.  
- **SR6.3:** Automatic expense splitting and deposit management.  
- **SR6.4:** Flight payment via Revolut upon booking completion.

### **SR7. Critical Communication and Stay Safety**  
- **SR7.1:** Multilingual chat with automatic translation.  
- **SR7.2:** Panic Button for emergencies with SMS/WhatsApp alerts.  
- **SR7.3:** P2P fallback for GPS data sharing.

### **SR8. Return and Follow-Up**  
- **SR8.1:** Calendar reminders (Google/Outlook) at 24 h, 3 h, and 1 h before return.  
- **SR8.2:** Post-trip evaluation with photo/video proof uploads.  
- **SR8.3:** Automated deposit lock/unlock based on dispute outcomes.

### **SR9. Analytics and Dashboard**  
- **SR9.1:** Grafana dashboard for hosts with occupancy, revenue, seasonal trends, and CO₂ emissions.  
- **SR9.2:** Grafana alerts for low occupancy, poor cleanliness scores, and last-minute cancellations.


## 7. High-Level Workflows

1. **Onboarding:** sign-up, verification, home listing
2. **Group & Destinations:** invite links, mood selection, trip proposals
3. **Match & Booking:** maps, flight booking, wallet setup
4. **Stay:** chat, car-share, emergencies
5. **Wrap-up:** reminders, feedback, deposit handling
