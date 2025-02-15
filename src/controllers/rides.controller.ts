import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { InviteStatus, RideStatus } from '@prisma/client';

export const getCurrentRide = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const ride = await prisma.ride.findFirst({
    where: {
      participants: {
        some: {
          id: userId
        }
      },
      status: RideStatus.PENDING
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true
        }
      },
      participants: {
        select: {
          id: true,
          name: true,
          phoneNumber: true
        }
      },
      stops: true
    }
  });

  if (!ride) {
    res.status(404).json({ error: 'Ride not found' });
    return
  }

  res.json({
    data: ride,
    error: null
  });
}

export const getRides = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const rides = await prisma.ride.findMany({
    where: {
      ownerId: userId
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true
        }
      },
      receivedInvites: {
        where: {
          status: InviteStatus.ACCEPTED
        },
        select: {
          sender: {
            select: {
              id: true,
              name: true,
              phoneNumber: true
            }
          }
        }
      },
      stops: true
    }
  });

  res.json({
    data: rides.map((r: any) => {
      r.participants = r.receivedInvites.map((ri: any) => ri.sender);
      delete r.receivedInvites;
      return r;
    }),
    error: null
  });
}

export const createRide = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const {
    stops,
    peopleCount,
    capacity,
    earliestDeparture,
    vehicleType,
    latestDeparture,
  } = req.body;

  if (!Array.isArray(stops)) {
    res.status(400).json({ data: null, error: 'Stops must be an array' });
    return
  }

  if (typeof peopleCount !== 'number') {
    res.status(400).json({ data: null, error: 'People count must be a number' });
    return
  }

  if (typeof capacity !== 'number') {
    res.status(400).json({ data: null, error: 'Capacity must be a number' });
    return
  }

  if (typeof earliestDeparture !== 'number' || isNaN(new Date(earliestDeparture).getTime())) {
    res.status(400).json({ data: null, error: 'Earliest departure must be a valid date' });
    return
  }

  if (typeof latestDeparture !== 'number' || isNaN(new Date(latestDeparture).getTime())) {
    res.status(400).json({ data: null, error: 'Latest departure must be a valid date' });
    return
  }

  if (new Date(earliestDeparture).getTime() > new Date(latestDeparture).getTime()) {
    res.status(400).json({ data: null, error: 'Earliest departure must be before latest departure' });
    return
  }

  if (stops.length < 2) {
    res.status(400).json({ data: null, error: 'Ride must have at least two stops' });
    return
  }

  const existingRide = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: RideStatus.PENDING
    }
  })

  if (existingRide) {
    res.status(400).json({
      data: null,
      error: 'You already have an active ride'
    })

    return
  }

  const ride = await prisma.ride.create({
    data: {
      ownerId: userId,
      participants: {
        connect: {
          id: userId
        }
      },
      peopleCount,
      capacity,
      earliestDeparture: new Date(earliestDeparture),
      latestDeparture: new Date(latestDeparture),
      vehicleType: vehicleType.toUpperCase(), //TODO: validate vehicleType
      stops: {
        createMany: {
          data: stops.map((stop: any) => ({
            lat: stop.lat,
            lon: stop.lon,
            name: stop.name
          }))
        }
      }
    }
  });

  res.json({
    data: ride,
    error: null
  });
}

export const cancelRide = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const reason = req.body.reason;

  if (typeof reason !== 'string') {
    res.status(400).json({ data: null, error: 'Reason must be a string' });
    return
  }

  if (reason.length < 10) {
    res.status(400).json({ data: null, error: 'Reason must be at least 10 characters' });
    return
  }

  const ride = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: RideStatus.PENDING
    },
    include: {
      owner: true
    }
  });

  if (!ride) {
    res.status(404).json({ error: 'Ride not found' });
    return
  }

  await prisma.$transaction(async tx => {
    const acceptedInvites = await tx.invite.updateManyAndReturn({
      where: {
        receiverRideId: ride.id,
        status: InviteStatus.ACCEPTED
      },
      data: {
        declineReason: 'Ride cancelled',
        status: InviteStatus.DECLINED
      }
    })

    await tx.user.updateMany({
      where: {
        id: {
          in: acceptedInvites.map(invite => invite.senderId)
        }
      },
      data: {
        currentRideId: null
      }
    })

    const pendingInvites = await tx.invite.updateManyAndReturn({
      where: {
        receiverRideId: ride.id,
        status: InviteStatus.PENDING
      },
      data: {
        declineReason: 'Ride cancelled',
        status: InviteStatus.DECLINED
      }
    })

    await tx.notification.createMany({
      data: pendingInvites
        .map(pi => ({
          receiverId: pi.senderId,
          message: `Your invite was declined by ${ride.owner.name} as the ride was cancelled. Reason: ${reason}`
        })).concat(acceptedInvites.map(ai => ({
          receiverId: ai.senderId,
          message: `Your active ride was cancelled by ${ride.owner.name}. Reason: ${reason}`
        })))
    })

    await prisma.ride.update({
      where: {
        id: ride.id
      },
      data: {
        status: RideStatus.CANCELLED,
        owner: {
          update: {
            currentRideId: null
          }
        }
      }
    })
  })

  res.json({
    data: null,
    error: null
  });
}