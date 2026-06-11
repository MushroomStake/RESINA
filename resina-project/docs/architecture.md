# RESINA Architecture Overview

RESINA is organized around three connected surfaces:

- Web portal: browser-based access for public landing pages and admin workflows.
- Mobile app: Expo/React Native experience for residents and day-to-day community updates.
- API service: Node-based services for tide, weather, alert dispatch, and background jobs.

## Core Data Flow

1. The API collects and refreshes tide, weather, and sensor data.
2. Supabase stores authentication, profiles, announcements, comments, history, and activity records.
3. The mobile app reads resident-facing updates and profile data.
4. The web portal serves admin dashboards, announcements management, reports, and personnel tools.

## Role Access

- Residents use the mobile app to view alerts, news, history, and their own profile.
- Admins use the web portal to monitor the station, publish announcements, review reports, and manage personnel.

## Security Notes

- Treat passwords, reset links, access tokens, and any encrypted or masked records as confidential.
- Keep role-based access in place: users should only see the data and actions assigned to their account.
- Do not copy sensitive records into unsecured notes, chats, or devices.