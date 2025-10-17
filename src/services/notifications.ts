import * as Notifications from 'expo-notifications';

type ReminderPayload = {
  id: string;
  name: string;
  expiryDate?: string | null;
};

const NOTIFICATION_HOUR = 9;
const OFFSETS_IN_DAYS = [3, 1, 0] as const;

const isPermissionGranted = (
  status: Notifications.NotificationPermissionsStatus
): boolean => {
  if (status.granted) {
    return true;
  }

  if (status.ios) {
    return (
      status.ios.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      status.ios.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }

  return false;
};

export async function registerForPushLikePermissions(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (isPermissionGranted(settings)) {
      return true;
    }

    const requested = await Notifications.requestPermissionsAsync();
    return isPermissionGranted(requested);
  } catch (error) {
    console.warn('[Notifications] Failed to register permissions', error);
    return false;
  }
}

const buildTriggerDate = (expiryDate: Date, offset: number) => {
  const trigger = new Date(expiryDate);
  trigger.setHours(NOTIFICATION_HOUR, 0, 0, 0);
  trigger.setDate(trigger.getDate() - offset);
  return trigger;
};

const isDateInFuture = (date: Date) => date.getTime() > Date.now();

export async function scheduleExpiryReminders({ id, name, expiryDate }: ReminderPayload) {
  if (!expiryDate) {
    return;
  }

  const permissionGranted = await registerForPushLikePermissions();
  if (!permissionGranted) {
    return;
  }

  const parsedExpiry = new Date(expiryDate);
  if (Number.isNaN(parsedExpiry.getTime())) {
    console.warn('[Notifications] Invalid expiry date', expiryDate);
    return;
  }

  await cancelExpiryReminders(id);

  await Promise.all(
    OFFSETS_IN_DAYS.map(async (offset) => {
      const triggerDate = buildTriggerDate(parsedExpiry, offset);
      if (!isDateInFuture(triggerDate)) {
        return;
      }

      const relative =
        offset === 0 ? "aujourd'hui" : offset === 1 ? 'demain' : `dans ${offset} jours`;

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Expiration ${relative}`,
            body: `${name} approche de sa date limite.`,
            data: {
              type: 'expiry',
              itemId: id,
              offset,
            },
          },
          trigger: triggerDate,
        });
      } catch (error) {
        console.warn('[Notifications] Failed to schedule reminder', {
          error,
          id,
          offset,
        });
      }
    })
  );
}

export async function cancelExpiryReminders(itemId: string) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const relevant = scheduled.filter(
      (request) => request.content?.data?.itemId === itemId && request.content?.data?.type === 'expiry'
    );

    await Promise.all(
      relevant.map((request) =>
        Notifications.cancelScheduledNotificationAsync(request.identifier).catch((error) =>
          console.warn('[Notifications] Failed to cancel reminder', { error, itemId })
        )
      )
    );
  } catch (error) {
    console.warn('[Notifications] Unable to cancel reminders', { error, itemId });
  }
}
