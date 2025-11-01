import { apiClient } from "./client";
import {
  Listing,
  CreateListingDto,
  UpdateListingDto,
  AddListingItemDto,
  UpdateListingItemDto,
} from "@/types/listing";

class ListingsService {
  // Get all listings (public)
  async getListings(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    min_price?: number;
    max_price?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return apiClient.request<{
      data: Listing[];
      meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
      };
    }>(`/listings?${queryParams.toString()}`);
  }

  // Get a single listing (public)
  async getListing(id: number) {
    return apiClient.request<{ data: Listing }>(`/listings/${id}`);
  }

  // Get seller's own listings
  async getSellerListings(params?: {
    page?: number;
    per_page?: number;
    status?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return apiClient.request<{
      data: Listing[];
      meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
      };
    }>(`/seller/listings?${queryParams.toString()}`);
  }

  // Create a new listing
  async createListing(data: CreateListingDto) {
    return apiClient.request<{ data: Listing }>("/seller/listings", {
      method: "POST",
      body: data,
    });
  }

  // Update a listing
  async updateListing(id: number, data: UpdateListingDto) {
    return apiClient.request<{ data: Listing }>(`/seller/listings/${id}`, {
      method: "PUT",
      body: data,
    });
  }

  // Delete a listing
  async deleteListing(id: number) {
    return apiClient.request(`/seller/listings/${id}`, {
      method: "DELETE",
    });
  }

  // Update listing image
  async updateListingImage(id: number, image: File) {
    const formData = new FormData();
    formData.append("image", image);

    const headers = await apiClient.getHeaders();
    delete headers["Content-Type"]; // Let browser set content-type for FormData

    const response = await fetch(`/api/seller/listings/${id}/image`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Failed to upload image" }));
      throw new Error(error.message || "Failed to upload image");
    }

    return response.json();
  }

  // Add item to listing
  async addItem(listingId: number, data: AddListingItemDto) {
    return apiClient.request(`/seller/listings/${listingId}/items`, {
      method: "POST",
      body: data,
    });
  }

  // Update listing item
  async updateItem(
    listingId: number,
    itemId: number,
    data: UpdateListingItemDto
  ) {
    return apiClient.request(`/seller/listings/${listingId}/items/${itemId}`, {
      method: "PUT",
      body: data,
    });
  }

  // Remove item from listing
  async removeItem(listingId: number, itemId: number) {
    return apiClient.request(`/seller/listings/${listingId}/items/${itemId}`, {
      method: "DELETE",
    });
  }

  // Update item image
  async updateItemImage(listingId: number, itemId: number, image: File) {
    const formData = new FormData();
    formData.append("image", image);

    const headers = await apiClient.getHeaders();
    delete headers["Content-Type"];

    const response = await fetch(
      `/api/seller/listings/${listingId}/items/${itemId}/image`,
      {
        method: "POST",
        headers,
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Failed to upload image" }));
      throw new Error(error.message || "Failed to upload image");
    }

    return response.json();
  }

  // Toggle favorite
  async toggleFavorite(listingId: number) {
    return apiClient.request(`/listing/${listingId}/favorite-list`, {
      method: "POST",
    });
  }
}

export const listingsService = new ListingsService();
