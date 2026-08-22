# Cloud Pulse AI

CloudOps AI — Real-Time Cloud Performance Analytics & Predictive Auto-Scaling

Build a complete, professional, production-style web application called CloudOps AI.

The application is an AI-powered Cloud Operations and Infrastructure Monitoring platform that provides real-time cloud performance analytics, anomaly detection, workload prediction, intelligent auto-scaling recommendations, scaling simulation, cost optimization, alerts, audit logs, and cloud resource management.

The application must look and behave like a professional SaaS product suitable for a university project demonstration, technical review, portfolio, and future integration with AWS/Kubernetes.

Do not create a simple static dashboard. Build a functional full-stack application with a clean architecture, persistent database, authentication, realistic real-time data, API-ready structure, proper error handling, responsive UI, and complete navigation.

1. PRODUCT NAME

CloudOps AI

Tagline:

Predict. Optimize. Scale.

Short description:

AI-powered real-time cloud performance monitoring and predictive auto-scaling platform.

2. PRIMARY OBJECTIVE

The system should:

Monitor cloud infrastructure metrics.

Display real-time performance information.

Detect abnormal infrastructure behavior.

Analyze workload trends.

Predict future resource requirements.

Recommend scaling actions.

Simulate automatic scaling.

Track scale-up and scale-down events.

Estimate infrastructure costs.

Provide cost-saving recommendations.

Generate alerts.

Maintain complete audit logs.

Support multiple cloud resources.

Provide an architecture that can later connect to AWS, Azure, GCP, Kubernetes, and Prometheus.

The application should clearly demonstrate this workflow:

Collect → Analyze → Detect → Predict → Decide → Scale → Verify → Record

3. TECHNOLOGY REQUIREMENTS

Use a modern production-quality stack.

Frontend:

React

TypeScript

Tailwind CSS

shadcn/ui

Recharts or another reliable charting library

React Router

TanStack Query where useful

Backend/database:

Supabase

PostgreSQL

Supabase Authentication

Supabase Row Level Security

Edge Functions/API endpoints where appropriate

Architecture:

Separate UI components from business logic.

Use reusable components.

Use typed API/database interfaces.

Do not place all logic in one component.

Keep the code modular and maintainable.

Prepare the application so a Python/FastAPI AI service can later be connected through REST APIs.

4. DESIGN REQUIREMENTS

Create a premium professional cloud SaaS interface.

Design style:

Dark professional cloud/DevOps theme.

Clean modern interface.

High information density without becoming cluttered.

Professional typography.

Rounded cards.

Subtle borders.

Professional status indicators.

Responsive layout.

Desktop-first but mobile responsive.

Smooth but restrained animations.

No excessive gradients.

No unnecessary decorative elements.

Use a consistent design system.

Status colors:

Green = Healthy

Yellow/Amber = Warning

Red = Critical

Blue = Information

Gray = Offline/Unknown

Do not use random colors throughout the application.

5. APPLICATION LAYOUT

Create a persistent left sidebar.

Sidebar:

Overview

Infrastructure

Live Metrics

AI Insights

Auto-Scaling

Cost Optimization

Alerts

Scaling History

Logs & Audit

Reports

Settings

Top navigation:

Global search

Environment selector

Notification icon

System health indicator

User profile

Theme toggle

Sidebar should collapse on smaller screens.

6. AUTHENTICATION

Implement complete authentication using Supabase Auth.

Pages:

Login

Sign Up

Forgot Password

Reset Password

Email Verification

Logout

Login fields:

Email

Password

Remember me

Add:

Form validation

Loading state

Error messages

Success messages

Protected routes

After login, redirect to Overview.

Create user profile information.

Roles:

Admin

Operator

Viewer

Permissions:

Admin:

Full access

Manage infrastructure

Configure scaling

Configure alerts

Manage users/settings

Operator:

View infrastructure

Manage scaling

Acknowledge alerts

View logs

Viewer:

Read-only dashboard

Cannot modify infrastructure or scaling policies

Use database-level Row Level Security wherever possible.

7. OVERVIEW DASHBOARD

Create a professional executive dashboard.

Header:

CloudOps AI Overview

Subtitle:

Real-time cloud infrastructure intelligence

Top summary cards:

Infrastructure Health

Active Resources

Current CPU

Current Memory

Requests/minute

Average Latency

Current Estimated Cost

Active Alerts

Example:

Infrastructure Health:

Healthy

Resources:

12

CPU:

68.4%

Memory:

61.2%

Requests:

2,450/min

Latency:

184 ms

Cost:

₹2,840/month

Alerts:

3

Do not hard-code these values permanently. Store/read them from the database or simulation engine.

8. REAL-TIME PERFORMANCE SECTION

Create real-time charts.

Charts:

CPU utilization

Memory utilization

Network traffic

Request rate

Response latency

Error rate

Active instances

Allow time ranges:

Last 5 minutes

Last 15 minutes

Last 30 minutes

Last 1 hour

Last 6 hours

Last 24 hours

Last 7 days

Charts should update automatically when live/simulation mode is enabled.

Show:

Current value

Average

Minimum

Maximum

Trend

Percentage change

9. INFRASTRUCTURE PAGE

Create an infrastructure resource management page.

Support resource types:

EC2

Kubernetes Pod

Kubernetes Node

Container

Database

Load Balancer

Server

Each resource should have:

Resource ID

Name

Type

Provider

Region

Status

CPU

Memory

Network

Requests

Latency

Instance count

Created date

Last updated

Statuses:

Healthy

Warning

Critical

Offline

Create:

Add Resource

form with:

Resource name

Resource type

Cloud provider

Region

Environment

Minimum instances

Maximum instances

Target CPU

Target memory

Allow:

View

Edit

Enable/Disable

Delete

Require confirmation before deletion.

10. ENVIRONMENTS

Support multiple environments:

Development

Testing

Staging

Production

Provide an environment selector.

All dashboard data should change according to the selected environment.

Example:

Production:

12 resources

Staging:

5 resources

Development:

3 resources

11. LIVE MONITORING

Create a dedicated Live Metrics page.

Display live infrastructure metrics.

Metrics:

CPU
Memory
Disk
Network In
Network Out
Requests
Latency
Errors
Connections
Instance count

Show a live indicator:

● LIVE

Add:

Pause Monitoring

Resume Monitoring

When paused, charts stop updating.

12. DEMO / SIMULATION MODE

This is extremely important for the university project.

Create a professional Simulation Control Center.

Allow the reviewer to simulate:

Normal Load

High Traffic

Traffic Spike

CPU Spike

Memory Pressure

Network Spike

Server Failure

Traffic Drop

Recovery

Buttons:

Normal Load

Generate High Traffic

Generate Traffic Spike

CPU Stress

Memory Stress

Server Failure

Reduce Traffic

Recover System

Simulation must update the dashboard dynamically.

Example:

Normal:

CPU = 42%

High Traffic:

CPU = 85%

Traffic Spike:

CPU = 95%

Then trigger AI analysis.

13. AI INSIGHTS

Create an AI Insights page.

Sections:

Current AI Status

AI engine status

Last analysis time

Prediction confidence

Current risk level

Risk levels:

Low

Medium

High

Critical

Workload Prediction

Predict:

Next 5 minutes

Next 15 minutes

Next 30 minutes

Next 1 hour

Display:

Current traffic:

2,400 req/min

Predicted:

3,850 req/min

Prediction confidence:

92%

Trend:

Increasing

AI Recommendation

Example:

Scale from 4 to 6 instances

Reason:

Predicted traffic is expected to exceed the configured capacity within the next 5 minutes.

14. AI IMPLEMENTATION

Do not fake the AI with a static text response.

Create a deterministic prediction engine for the prototype using historical metrics.

Use inputs:

CPU

Memory

Request rate

Latency

Error rate

Historical workload

Current instance count

Calculate:

Moving averages

Trend

Growth rate

Predicted workload

Risk score

Recommended instance count

Create a clear service layer called:

predictionEngine

The architecture must allow this service to later be replaced with a Python ML model.

Prediction output:

predicted_load
confidence
risk_level
recommended_instances
reason


15. ANOMALY DETECTION

Implement anomaly detection for:

Sudden CPU increase

Sudden memory increase

Traffic spikes

Latency increase

Error rate increase

Instance failure

Show anomaly cards.

Example:

Anomaly Detected

CPU increased from 52% to 94% in 60 seconds.

Severity:

Critical

Recommended action:

Scale up

Allow:

Acknowledge

Resolve

View details

16. AUTO-SCALING PAGE

Create a dedicated Auto-Scaling page.

Display:

Current instances

Minimum instances

Maximum instances

Target CPU

Target Memory

Current CPU

Predicted workload

Recommended instances

Scaling status

Create scaling policy configuration.

Example:

Minimum:

2

Maximum:

10

Target CPU:

70%

Target Memory:

75%

Scale-up cooldown:

300 seconds

Scale-down cooldown:

600 seconds

17. AUTO-SCALING ENGINE

Implement a real decision engine for the prototype.

Logic:

If current CPU > target CPU
OR predicted workload exceeds capacity:

Scale Up.

If CPU remains significantly below target
AND predicted workload decreases:

Scale Down.

Never exceed maximum instances.

Never go below minimum instances.

Include cooldown protection to prevent rapid repeated scaling.

Example:

Current instances = 4
Target CPU = 70%
Current CPU = 91%
Predicted load = HIGH

Decision:

Scale Up

Recommended instances = 6


Then record the scaling event.

18. SCALING SIMULATION

Create a simulation that visually demonstrates scaling.

Example:

4 instances

↓

AI detects high load

↓

Recommendation: 6 instances

↓

Scaling initiated

↓

5 instances

↓

6 instances

↓

System stabilized

Show a progress indicator.

Final status:

Scaling Completed

Before:

4

After:

6

Reason:

High predicted workload

19. SCALE DOWN

Also demonstrate scale-down.

Example:

6 instances

Traffic falls

↓

AI predicts low demand

↓

Recommendation:

3 instances

↓

6 → 5 → 4 → 3

Final status:

Resources optimized

This is important because the project must demonstrate both:

Performance optimization

and

Cost optimization

20. COST OPTIMIZATION

Create a Cost Optimization page.

Show:

Current hourly cost

Daily cost

Monthly projected cost

Cost per resource

Cost trend

Estimated savings

Idle resources

Over-provisioned resources

Example:

Current monthly estimate:

₹18,450

Optimized estimate:

₹13,820

Potential saving:

₹4,630/month

Add:

AI Cost Recommendation

Example:

"Resource EC2-04 is consistently below 20% utilization. Consider reducing capacity during low-traffic periods."

Create a cost history chart.

21. ALERTS

Create complete alert management.

Alert types:

High CPU

High Memory

High Latency

High Error Rate

Traffic Spike

Resource Failure

Scaling Event

Cost Threshold

Anomaly Detected

Each alert:

ID

Severity

Title

Description

Resource

Timestamp

Status

Acknowledged by

Resolved by

Statuses:

Active

Acknowledged

Resolved

Allow:

Acknowledge

Resolve

Filter

Search

22. NOTIFICATION CENTER

Create notification dropdown.

Show:

Critical alerts

Scaling events

AI predictions

Infrastructure failures

Cost warnings

Unread notification count.

Allow:

Mark all as read

23. SCALING HISTORY

Create a dedicated history page.

Table:

Timestamp

Resource

Environment

Action

Before

After

Reason

Trigger

Status

Example:

12:32 PM

Production API

Scale Up

4 → 6

High CPU + predicted traffic

AI

Completed

Filters:

Date

Environment

Resource

Action

Status

24. LOGS & AUDIT

Create an audit log page.

Record:

Login

Logout

Resource creation

Resource deletion

Scaling configuration changes

Scaling events

Alert acknowledgement

Alert resolution

Environment changes

User changes

Fields:

Timestamp

User

Action

Resource

Details

IP if available

Status

Provide search and filtering.

25. REPORTS

Create Reports page.

Generate:

Performance Report

Average CPU

Average memory

Peak traffic

Average latency

Error rate

Availability

Scaling Report

Scale-up events

Scale-down events

Total scaling actions

Average instances

Cost Report

Estimated monthly cost

Optimization

Savings

AI Report

Predictions

Accuracy

Anomalies

Recommendations

Allow export to CSV.

Create printable report layout.

26. SETTINGS

Create complete settings.

Sections:

General

Organization name

Default environment

Timezone

Monitoring

Refresh interval

Data retention

Auto-Scaling

Enable/disable

Minimum instances

Maximum instances

CPU target

Memory target

Cooldown

Alerts

Enable alerts

Severity thresholds

Notification preferences

AI

Prediction interval

Confidence threshold

Risk threshold

Appearance

Dark mode

Light mode

27. CLOUD PROVIDER INTEGRATION ARCHITECTURE

Prepare the project for:

AWS

Azure

Google Cloud

Kubernetes

Create an abstraction layer:

CloudProviderAdapter

with future methods:

getResources()
getMetrics()
scaleResource()
getResourceStatus()
getCost()


Do not hard-code AWS-specific logic into the UI.

Initially implement:

DemoProvider

The DemoProvider provides realistic simulated infrastructure data.

Later create:

AWSProvider

KubernetesProvider

without changing the dashboard.

28. PROMETHEUS-READY ARCHITECTURE

Prepare API structure for Prometheus.

Expected metrics:

cpu_usage

memory_usage

network_in

network_out

request_rate

latency

error_rate

instance_count

Create a service abstraction:

MetricsProvider

Implement:

DemoMetricsProvider

Prepare:

PrometheusMetricsProvider

for future integration.

29. DATABASE DESIGN

Create PostgreSQL tables.

Required tables:

profiles

id

user_id

name

email

role

organization_id

created_at

organizations

id

name

created_at

environments

id

organization_id

name

description

status

created_at

resources

id

environment_id

name

resource_type

provider

region

status

min_instances

max_instances

target_cpu

target_memory

created_at

updated_at

metrics

id

resource_id

timestamp

cpu

memory

disk

network_in

network_out

requests

latency

error_rate

instance_count

predictions

id

resource_id

timestamp

predicted_load

confidence

risk_level

recommended_instances

reasoning

scaling_policies

id

resource_id

min_instances

max_instances

target_cpu

target_memory

scale_up_cooldown

scale_down_cooldown

enabled

scaling_events

id

resource_id

timestamp

action

previous_instances

new_instances

reason

trigger

status

alerts

id

resource_id

severity

title

description

status

created_at

acknowledged_at

resolved_at

notifications

id

user_id

title

message

type

read

created_at

audit_logs

id

user_id

action

resource_type

resource_id

details

created_at

cost_records

id

resource_id

timestamp

hourly_cost

daily_cost

monthly_estimate

Use proper relationships, indexes, timestamps, and Row Level Security.

30. REAL-TIME DATA

Use Supabase real-time subscriptions where appropriate.

When a new metric is generated:

Dashboard updates

Charts update

AI analysis updates

Alerts update

Scaling status updates

Do not require a page refresh.

Show a visible:

LIVE

indicator.

31. DEMO DATA

On first installation/setup, provide realistic demo data.

Create:

Organization:

CloudOps Demo

Environments:

Development

Staging

Production

Resources:

Production API Server

Production Worker

Production Database

Production Load Balancer

Staging API

Development API

Generate historical metrics for at least 24 hours.

Do not use obviously random values. Metrics should have realistic patterns and trends.

32. DEMO MODE

Add a top-level switch:

Demo Mode

When enabled, show:

Demo Environment

Provide controls:

Normal Load

Traffic Spike

CPU Stress

Memory Stress

Server Failure

Traffic Drop

Recovery

The simulation must trigger the same monitoring, AI, alert, scaling, history, and cost logic used by the application.

Do not create a separate fake dashboard just for the demo.

The simulation must operate through the actual application services.

33. PROJECT DEMONSTRATION MODE

Create a special button:

Start Presentation Demo

When clicked:

Reset demo environment.

Set system to normal state.

Start real-time metrics.

Show healthy infrastructure.

Increase traffic gradually.

Increase CPU.

Trigger anomaly.

Generate AI prediction.

Display scaling recommendation.

Trigger scale-up.

Show scaling progress.

Stabilize system.

Reduce traffic.

Predict lower workload.

Scale down.

Show estimated cost savings.

Display final summary.

Provide:

Pause Demo

Restart Demo

This allows the university reviewer to see the complete project in 3–5 minutes.

34. FINAL DEMO SUMMARY

At the end of Presentation Demo show:

CloudOps AI Results

Peak CPU:

94%

Traffic increase:

+180%

Anomalies detected:

3

Scale-up events:

2

Scale-down events:

1

Performance maintained:

99.2%

Estimated cost saving:

₹4,630/month

AI prediction confidence:

92%

Display this as a professional summary.

35. ERROR HANDLING

Implement:

Loading states

Empty states

Error states

Retry buttons

API failure handling

Database failure handling

Authentication errors

Permission errors

Invalid forms

Confirmation dialogs

Never show raw technical errors to normal users.

36. SECURITY

Implement:

Supabase authentication

Row Level Security

Role-based authorization

Protected routes

Input validation

Environment variables

No secrets in frontend

No cloud credentials stored in frontend

No hard-coded API keys

Secure API calls

Never expose AWS credentials or cloud secrets in browser code.

37. PERFORMANCE

Optimize:

Database queries

Chart rendering

Metric polling

Realtime subscriptions

Component rendering

Avoid unnecessary API calls.

Use pagination for large tables.

Use lazy loading where appropriate.

38. RESPONSIVE DESIGN

The application must work on:

Desktop

Laptop

Tablet

Mobile

The primary reviewer demonstration should be optimized for a 1366×768 or larger laptop screen.

39. USER EXPERIENCE

Every major action should have clear feedback.

Examples:

"Resource added successfully."

"Scaling policy updated."

"Scale-up initiated."

"Scaling completed."

"Alert acknowledged."

"Report exported."

Use professional toast notifications.

40. NAVIGATION

Every page must be connected.

Do not create dead buttons.

Every button should either:

perform an action,

open a modal,

navigate,

trigger a real simulation,

or clearly indicate that an integration is not configured.

Do not create fake buttons that do nothing.

41. API ARCHITECTURE

Create a clean service structure.

Example:

services/
  metricsService
  predictionService
  scalingService
  alertService
  costService
  resourceService
  auditService
  notificationService
  cloudProviderService


Business logic should live in services rather than UI components.

42. FUTURE PYTHON AI SERVICE

Prepare the application to call:

POST /api/predict


Input:

{
  "cpu": 82,
  "memory": 71,
  "requests": 2450,
  "latency": 184,
  "instances": 4
}


Expected output:

{
  "predicted_load": 3850,
  "confidence": 0.92,
  "risk_level": "HIGH",
  "recommended_instances": 6,
  "reason": "Increasing workload trend detected"
}


For now, provide a local TypeScript prediction engine if the external Python service is unavailable.

43. CLOUD SCALING API

Prepare the application for:

POST /api/scaling/scale


Input:

{
  "resource_id": "resource-id",
  "desired_instances": 6,
  "reason": "AI predicted high workload"
}


Output:

{
  "status": "success",
  "previous_instances": 4,
  "new_instances": 6
}


Initially use DemoProvider.

Do not execute real cloud scaling unless a real cloud provider integration is explicitly configured.

44. ENVIRONMENT CONFIGURATION

Use environment variables for:

Supabase URL

Supabase anonymous key

Backend URL

AI service URL

Cloud provider configuration

Never expose private credentials.

Provide a .env.example structure.

45. SEED DATA

Create a seed/demo data mechanism.

The user should be able to reset the entire demo environment.

Button:

Reset Demo Data

Confirmation:

"This will reset all demo metrics, alerts, predictions and scaling history."

46. PROFESSIONAL EMPTY STATES

Do not leave blank pages.

Example:

"No alerts currently active."

"All monitored resources are healthy."

"No scaling events in the selected period."

"Connect a cloud provider to begin collecting real infrastructure metrics."

47. ACCESSIBILITY

Implement:

Keyboard navigation

Accessible labels

Proper contrast

Focus states

Semantic HTML

Screen-reader friendly controls

48. DOCUMENTATION PAGE

Create an internal Documentation page explaining:

What CloudOps AI is

System architecture

Monitoring

AI prediction

Anomaly detection

Auto-scaling

Cost optimization

Demo mode

Cloud integration

Security

Include a simple architecture diagram.

49. ABOUT PROJECT PAGE

Create:

About CloudOps AI

Description:

"CloudOps AI is an intelligent cloud operations platform designed to monitor infrastructure in real time, predict workload demand, detect anomalies, recommend resource changes, and automate scaling decisions."

Show:

Project objective

Technology stack

Architecture

Key features

Future scope

50. FINAL QUALITY REQUIREMENTS

Before considering the project complete, verify:

Authentication works.

Protected routes work.

Dashboard loads.

Database operations work.

Demo data loads.

Metrics update.

Charts update.

Simulation controls work.

AI prediction works.

Anomaly detection works.

Scaling recommendation works.

Scale-up simulation works.

Scale-down simulation works.

Alerts work.

Notifications work.

Scaling history works.

Audit logs work.

Cost calculations work.

Reports work.

CSV export works.

Settings work.

Role permissions work.

Responsive design works.

No dead buttons.

No broken navigation.

No console errors.

No exposed secrets.

No fake cloud credentials.

No unnecessary placeholder content.

51. IMPORTANT IMPLEMENTATION RULE

Do NOT attempt to create a fake "AI" label over static numbers.

The system must have actual calculation logic for:

workload trend

prediction

confidence

anomaly detection

scaling recommendation

cost estimation

Use deterministic and explainable logic for the prototype.

The application should clearly distinguish:

Demo/Simulation Mode

from

Real Cloud Mode

Real cloud mode should only become active after provider credentials/configuration are explicitly provided.

52. FINAL PRODUCT GOAL

The completed application should allow a reviewer to open CloudOps AI and immediately understand:

What is happening?

→ Real-time infrastructure monitoring.

What will happen?

→ AI workload prediction.

What should we do?

→ AI scaling recommendation.

What does the system do?

→ Automatically scale resources in the configured environment.

Why is it useful?

→ Better performance, fewer outages, and lower cloud costs.

The complete user journey should be:

Login → Overview → Monitor → Detect → Predict → Recommend → Scale → Verify → Optimize → Report

Build the application incrementally if necessary, but do not remove any of the requirements above.

Start by creating the complete application architecture, database schema, authentication, navigation, dashboard shell, reusable UI components, and demo data. Then implement each functional module and connect everything together.

The final result must feel like a real professional CloudOps SaaS product rather than a student static dashboard.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6e716b7e-6188-425e-934d-a82a9c7aa678).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
