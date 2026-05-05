/**
 * SSSAM CRM - Enhanced Enquiry Service
 * Multiple Course Admission System
 */

// Import existing API functions
const { updateEnquiry, apiGet } = require('./api.js');

/**
 * Update Enquiry Status with Enhanced Error Handling
 * @param {string} enquiryId - The enquiry ID
 * @param {string} status - New status
 * @param {string} note - Optional note for status change
 * @returns {Promise<Object>} Result object with success/error info
 */
export const updateEnquiryStatus = async (enquiryId, status, note = '') => {
  try {
    const response = await updateEnquiry(enquiryId, { 
      status, 
      note,
      updatedAt: new Date().toISOString()
    });
    
    return { 
      success: true, 
      data: response.data || response,
      message: 'Enquiry status updated successfully'
    };
  } catch (error) {
    console.error('Status update error:', error);
    
    if (error.response?.status === 400) {
      const errorMessage = error.response.data?.message || 'Status update failed';
      
      // Handle admission exists error
      if (errorMessage.includes('admission already exists')) {
        return { 
          success: false, 
          error: errorMessage,
          type: 'ADMISSION_EXISTS',
          message: 'Cannot change status - student already admitted in this course'
        };
      }
      
      return { 
        success: false, 
        error: errorMessage,
        type: 'VALIDATION_ERROR'
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Network error occurred',
      type: 'NETWORK_ERROR'
    };
  }
};

/**
 * Update Enquiry Course with Admission Conflict Check
 * @param {string} enquiryId - The enquiry ID
 * @param {string} course - New course
 * @returns {Promise<Object>} Result object with success/error info
 */
export const updateEnquiryCourse = async (enquiryId, course) => {
  try {
    const response = await updateEnquiry(enquiryId, { 
      course,
      updatedAt: new Date().toISOString()
    });
    
    return { 
      success: true, 
      data: response.data || response,
      message: 'Course updated successfully'
    };
  } catch (error) {
    console.error('Course update error:', error);
    
    if (error.response?.status === 400) {
      const errorMessage = error.response.data?.message || 'Course update failed';
      
      // Handle already admitted error
      if (errorMessage.includes('Already admitted') || errorMessage.includes('admission already exists')) {
        return { 
          success: false, 
          error: errorMessage,
          type: 'ALREADY_ADMITTED',
          message: 'Already admitted in this course. Please select a different course.'
        };
      }
      
      return { 
        success: false, 
        error: errorMessage,
        type: 'VALIDATION_ERROR'
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Network error occurred',
      type: 'NETWORK_ERROR'
    };
  }
};

/**
 * Check if student has existing admission for a course
 * @param {string} enquiryId - The enquiry ID
 * @param {string} course - Course to check
 * @returns {Promise<Object>} Result indicating if admission exists
 */
export const checkExistingAdmission = async (enquiryId, course) => {
  try {
    // Get enquiry details with admission info
    const response = await apiGet(`/enquiries/${enquiryId}/check-admission`, { course });
    
    return { 
      success: true, 
      hasAdmission: response.hasAdmission || false,
      admissionDetails: response.admission || null
    };
  } catch (error) {
    console.error('Admission check error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to check admission status'
    };
  }
};

/**
 * Get available courses for student (excluding already admitted courses)
 * @param {string} enquiryId - The enquiry ID
 * @returns {Promise<Object>} Available courses list
 */
export const getAvailableCourses = async (enquiryId) => {
  try {
    const response = await apiGet(`/enquiries/${enquiryId}/available-courses`);
    
    return { 
      success: true, 
      courses: response.courses || [],
      alreadyAdmittedCourses: response.alreadyAdmittedCourses || []
    };
  } catch (error) {
    console.error('Available courses error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to get available courses'
    };
  }
};

/**
 * Batch update multiple enquiries
 * @param {Array} updates - Array of {id, status, note} objects
 * @returns {Promise<Object>} Batch update results
 */
export const batchUpdateEnquiries = async (updates) => {
  try {
    const response = await apiPost('/enquiries/batch-update', { updates });
    
    return { 
      success: true, 
      data: response.data,
      message: `Updated ${updates.length} enquiries successfully`
    };
  } catch (error) {
    console.error('Batch update error:', error);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      failedUpdates: error.response?.data?.failedUpdates || []
    };
  }
};

/**
 * Get enquiry status history
 * @param {string} enquiryId - The enquiry ID
 * @returns {Promise<Object>} Status history
 */
export const getEnquiryHistory = async (enquiryId) => {
  try {
    const response = await apiGet(`/enquiries/${enquiryId}/history`);
    
    return { 
      success: true, 
      history: response.history || []
    };
  } catch (error) {
    console.error('History fetch error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch enquiry history'
    };
  }
};

// Utility function to format error messages for UI display
export const formatErrorMessage = (errorResult) => {
  if (!errorResult.success) {
    switch (errorResult.type) {
      case 'ADMISSION_EXISTS':
        return 'Cannot change status - student already admitted in this course. Status changes only allowed if course is different.';
      case 'ALREADY_ADMITTED':
        return 'Already admitted in this course. Cannot change to a course where admission already exists.';
      case 'VALIDATION_ERROR':
        return errorResult.error || 'Invalid data provided';
      case 'NETWORK_ERROR':
        return 'Network error. Please check your connection and try again.';
      default:
        return errorResult.error || 'An unexpected error occurred';
    }
  }
  return '';
};
