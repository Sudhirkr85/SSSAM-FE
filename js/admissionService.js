/**
 * SSSAM CRM - Enhanced Admission Service
 * Multiple Course Admission System with Duplicate Prevention
 */

// Import existing API functions
const { createAdmission: baseCreateAdmission, apiGet, apiPost } = require('./api.js');

/**
 * Create Admission with Duplicate Prevention
 * @param {Object} admissionData - Admission data including enquiryId, course, fees, etc.
 * @returns {Promise<Object>} Result object with success/error info
 */
export const createAdmission = async (admissionData) => {
  try {
    // Validate required fields
    const requiredFields = ['enquiryId', 'course', 'totalFees', 'paymentType'];
    const missingFields = requiredFields.filter(field => !admissionData[field]);
    
    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        type: 'VALIDATION_ERROR'
      };
    }

    // Add timestamps
    const enrichedData = {
      ...admissionData,
      admissionDate: admissionData.admissionDate || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: 'ACTIVE'
    };

    const response = await baseCreateAdmission(enrichedData);
    
    return { 
      success: true, 
      data: response.data || response,
      message: 'Admission created successfully'
    };
  } catch (error) {
    console.error('Admission creation error:', error);
    
    if (error.response?.status === 409) {
      const errorMessage = error.response.data?.message || 'Duplicate admission detected';
      
      return { 
        success: false, 
        error: errorMessage,
        type: 'DUPLICATE_ADMISSION',
        message: 'Already admitted in this course. Cannot create duplicate admission.',
        existingAdmission: error.response.data?.existingAdmission
      };
    }
    
    if (error.response?.status === 400) {
      const errorMessage = error.response.data?.message || 'Validation failed';
      
      if (errorMessage.includes('already admitted')) {
        return { 
          success: false, 
          error: errorMessage,
          type: 'ALREADY_ADMITTED',
          message: 'Student is already admitted in this course.',
          existingAdmission: error.response.data?.existingAdmission
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
 * Check for existing admission before creating new one
 * @param {string} enquiryId - The enquiry ID
 * @param {string} course - Course to check
 * @returns {Promise<Object>} Result indicating if admission exists
 */
export const checkExistingAdmission = async (enquiryId, course) => {
  try {
    const response = await apiGet(`/admissions/check-existing`, { 
      enquiryId, 
      course 
    });
    
    return { 
      success: true, 
      hasAdmission: response.hasAdmission || false,
      admissionDetails: response.admission || null,
      canAdmit: !response.hasAdmission
    };
  } catch (error) {
    console.error('Admission check error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to check admission status',
      type: 'NETWORK_ERROR'
    };
  }
};

/**
 * Get all admissions for a student
 * @param {string} enquiryId - The enquiry ID
 * @returns {Promise<Object>} List of student admissions
 */
export const getStudentAdmissions = async (enquiryId) => {
  try {
    const response = await apiGet(`/admissions/student/${enquiryId}`);
    
    return { 
      success: true, 
      admissions: response.admissions || [],
      totalAdmissions: response.total || 0
    };
  } catch (error) {
    console.error('Student admissions fetch error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch student admissions'
    };
  }
};

/**
 * Get available courses for new admission
 * @param {string} enquiryId - The enquiry ID
 * @returns {Promise<Object>} Available courses excluding already admitted ones
 */
export const getAvailableCoursesForAdmission = async (enquiryId) => {
  try {
    const response = await apiGet(`/admissions/available-courses/${enquiryId}`);
    
    return { 
      success: true, 
      availableCourses: response.availableCourses || [],
      alreadyAdmittedCourses: response.alreadyAdmittedCourses || [],
      allCourses: response.allCourses || []
    };
  } catch (error) {
    console.error('Available courses fetch error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to get available courses'
    };
  }
};

/**
 * Create admission with installment plan
 * @param {Object} admissionData - Admission data with installments
 * @returns {Promise<Object>} Result with admission and installment details
 */
export const createAdmissionWithInstallments = async (admissionData) => {
  try {
    // Validate installment data if payment type is INSTALLMENT
    if (admissionData.paymentType === 'INSTALLMENT') {
      if (!admissionData.installments || admissionData.installments.length === 0) {
        return {
          success: false,
          error: 'Installment details required for installment payment type',
          type: 'VALIDATION_ERROR'
        };
      }
      
      // Validate installment amounts sum to total fees
      const totalInstallmentAmount = admissionData.installments.reduce(
        (sum, installment) => sum + (installment.amount || 0), 0
      );
      
      if (totalInstallmentAmount !== admissionData.totalFees) {
        return {
          success: false,
          error: 'Installment amounts must sum to total fees',
          type: 'VALIDATION_ERROR'
        };
      }
    }

    const response = await apiPost('/admissions/with-installments', admissionData);
    
    return { 
      success: true, 
      data: response.data || response,
      message: 'Admission with installments created successfully'
    };
  } catch (error) {
    console.error('Admission with installments error:', error);
    
    if (error.response?.status === 409) {
      return { 
        success: false, 
        error: error.response.data?.message || 'Duplicate admission detected',
        type: 'DUPLICATE_ADMISSION'
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Failed to create admission with installments',
      type: 'NETWORK_ERROR'
    };
  }
};

/**
 * Update admission details
 * @param {string} admissionId - The admission ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Update result
 */
export const updateAdmission = async (admissionId, updateData) => {
  try {
    const response = await apiPut(`/admissions/${admissionId}`, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    
    return { 
      success: true, 
      data: response.data || response,
      message: 'Admission updated successfully'
    };
  } catch (error) {
    console.error('Admission update error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to update admission'
    };
  }
};

/**
 * Get admission payment history
 * @param {string} admissionId - The admission ID
 * @returns {Promise<Object>} Payment history
 */
export const getAdmissionPaymentHistory = async (admissionId) => {
  try {
    const response = await apiGet(`/admissions/${admissionId}/payments`);
    
    return { 
      success: true, 
      payments: response.payments || [],
      totalPaid: response.totalPaid || 0,
      balanceDue: response.balanceDue || 0
    };
  } catch (error) {
    console.error('Payment history fetch error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch payment history'
    };
  }
};

/**
 * Calculate admission statistics for a student
 * @param {string} enquiryId - The enquiry ID
 * @returns {Promise<Object>} Student admission statistics
 */
export const getStudentAdmissionStats = async (enquiryId) => {
  try {
    const response = await apiGet(`/admissions/student-stats/${enquiryId}`);
    
    return { 
      success: true, 
      stats: response.stats || {
        totalAdmissions: 0,
        totalFeesPaid: 0,
        totalBalanceDue: 0,
        coursesAdmitted: []
      }
    };
  } catch (error) {
    console.error('Student stats fetch error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch student statistics'
    };
  }
};

// Utility function to format admission error messages
export const formatAdmissionErrorMessage = (errorResult) => {
  if (!errorResult.success) {
    switch (errorResult.type) {
      case 'DUPLICATE_ADMISSION':
        return 'Already admitted in this course. Cannot create duplicate admission.';
      case 'ALREADY_ADMITTED':
        return 'Student is already admitted in this course. Please select a different course.';
      case 'VALIDATION_ERROR':
        return errorResult.error || 'Invalid admission data provided';
      case 'NETWORK_ERROR':
        return 'Network error. Please check your connection and try again.';
      default:
        return errorResult.error || 'An unexpected error occurred during admission';
    }
  }
  return '';
};

// Utility function to validate admission data before submission
export const validateAdmissionData = (admissionData) => {
  const errors = [];
  
  if (!admissionData.enquiryId) {
    errors.push('Student/Enquiry ID is required');
  }
  
  if (!admissionData.course) {
    errors.push('Course selection is required');
  }
  
  if (!admissionData.totalFees || admissionData.totalFees <= 0) {
    errors.push('Total fees must be greater than 0');
  }
  
  if (!admissionData.paymentType) {
    errors.push('Payment type is required');
  }
  
  if (admissionData.paymentType === 'INSTALLMENT') {
    if (!admissionData.installments || admissionData.installments.length === 0) {
      errors.push('Installment details are required for installment payment');
    } else {
      const totalInstallmentAmount = admissionData.installments.reduce(
        (sum, installment) => sum + (installment.amount || 0), 0
      );
      
      if (totalInstallmentAmount !== admissionData.totalFees) {
        errors.push('Installment amounts must sum to total fees');
      }
      
      // Validate each installment
      admissionData.installments.forEach((installment, index) => {
        if (!installment.dueDate) {
          errors.push(`Installment ${index + 1}: Due date is required`);
        }
        if (!installment.amount || installment.amount <= 0) {
          errors.push(`Installment ${index + 1}: Amount must be greater than 0`);
        }
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
