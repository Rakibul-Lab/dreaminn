/** Shared role labels and permission helpers (client + server safe). */

export type AppRole = 'ADMIN' | 'HOTEL_STAFF' | 'HOTEL_FD' | 'RESTAURANT_STAFF';

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Admin',
  HOTEL_STAFF: 'Hotel Manager',
  HOTEL_FD: 'Hotel F.D.',
  RESTAURANT_STAFF: 'Restaurant Staff',
};

export function formatRoleLabel(role: string | undefined | null): string {
  if (!role) return '—';
  return ROLE_LABELS[role as AppRole] ?? role.replace(/_/g, ' ');
}

export function canAccessHotel(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'HOTEL_STAFF' || role === 'HOTEL_FD';
}

export function canAccessRestaurant(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'RESTAURANT_STAFF';
}

export function canAccessAdmin(role: string | undefined | null): boolean {
  return role === 'ADMIN';
}

/** Hotel Manager + Admin — full room & room-type management */
export function canManageRoomInventory(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'HOTEL_STAFF';
}

/** Front desk: rooms list + status changes only */
export function isHotelFrontDesk(role: string | undefined | null): boolean {
  return role === 'HOTEL_FD';
}

export function isHotelManager(role: string | undefined | null): boolean {
  return role === 'HOTEL_STAFF';
}

export function isHotelTeamMember(role: string | undefined | null): boolean {
  return role === 'HOTEL_STAFF' || role === 'HOTEL_FD';
}

export function canAccessRoomTypesNav(role: string | undefined | null): boolean {
  return canManageRoomInventory(role);
}

export function canPerformHotelClearance(role: string | undefined | null): boolean {
  return canAccessAdmin(role) || isHotelTeamMember(role);
}
