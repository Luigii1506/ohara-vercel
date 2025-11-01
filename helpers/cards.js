export async function getUserByEmail(email) {
  // Construimos la URL absoluta usando NEXTAUTH_URL o localhost
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  // Suponiendo que tu endpoint es /api/admin/user y recibe el email como query param
  const url = `${baseUrl}/api/admin/user?email=${encodeURIComponent(email)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error fetching user: ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error en getUserByEmail:", error);
    throw error;
  }
}
