# Ride NITT TC API

All responses are of the format `{ data: any | null, error: string | null }`. If you dont get this kind of response, it's probably an error, so dm me. (this is meant for SPAM team)

## `/auth/send-otp`
POST with json body `{ phoneNumber }` in the format `+91\d{10}`

## `/auth/verify-otp`
POST with json body `{ phoneNumber, otp }` both string

(below routes available only after otp verification i.e after auth)

## `/api/users/me`
GET returns user profile
POST with json body `{ name, gender, address, password, confirmPassword }` all string, update the profile

## `/api/autocomplete`
GET with query `?q=pal&point=[lat],[lng]`, returns graphhopper autocomplete results such as Palpannai etc.

## `/api/rides`
GET returns all rides offering that user has created
POST with json body `{ stops: { lat, lon, name }[], earliestDeparture: Unix epoch, latestDeparture: Unix epoch, capacity: number, vehicleType: car | taxi | auto }` creates a ride offering

## `/api/rides/current`
GET returns current ride object (check prisma type), this is applicable for both ride offerer and ride seeker
DELETE cancels current ride offering

## `/api/suggestions`
GET returns all ride offerings that user can send join request to

## `/api/invites`
GET returns all incoming invites to the current ride offering
POST with json body `{ rideId }` to send an invite

## `/api/invites/:id/accept`
POST to accept an invite

## `/api/invites/:id/decline`
POST with json body `{ reason }` to decline an invite or remove after accepting an in

## `/api/notifications`
GET returns latest notifications of the user such as if the ride offerer cancels the ride