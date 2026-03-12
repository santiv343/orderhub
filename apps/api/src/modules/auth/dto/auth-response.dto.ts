export class UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: Date;

  constructor(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
    isActive: boolean;
    createdAt: Date;
  }) {
    this.id = user.id;
    this.email = user.email;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.isEmailVerified = user.isEmailVerified;
    this.isActive = user.isActive;
    this.createdAt = user.createdAt;
  }
}
