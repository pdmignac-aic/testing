# ============================================
# PRACTICE EXERCISES
# ============================================
# Try solving each exercise on your own first!
# Run this file with: python exercises.py
# Solutions are at the bottom — no peeking!

print("=" * 40)
print("EXERCISE 1: Personal Info")
print("=" * 40)
# Create variables for your name, age, and favorite color.
# Print a sentence using all three, like:
# "My name is Alice, I'm 25, and I love blue."
#
# YOUR CODE HERE:



print()
print("=" * 40)
print("EXERCISE 2: Even or Odd")
print("=" * 40)
# Write code that checks if a number is even or odd
# and prints the result. Test with number = 7.
#
# YOUR CODE HERE:
number = 7



print()
print("=" * 40)
print("EXERCISE 3: Sum of a List")
print("=" * 40)
# Calculate the sum of all numbers in this list
# WITHOUT using the built-in sum() function.
# Use a for loop instead.
#
# YOUR CODE HERE:
numbers = [4, 8, 15, 16, 23, 42]



print()
print("=" * 40)
print("EXERCISE 4: FizzBuzz")
print("=" * 40)
# Classic programming challenge!
# For numbers 1 to 20:
#   - If divisible by 3, print "Fizz"
#   - If divisible by 5, print "Buzz"
#   - If divisible by both 3 and 5, print "FizzBuzz"
#   - Otherwise, print the number
#
# YOUR CODE HERE:



print()
print("=" * 40)
print("EXERCISE 5: Write a Function")
print("=" * 40)
# Write a function called max_of_three that takes three
# numbers and returns the largest one.
# Test it: max_of_three(3, 9, 5) should return 9.
#
# YOUR CODE HERE:



# ============================================
# SCROLL DOWN FOR SOLUTIONS
# ============================================
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
# ============================================
# SOLUTIONS (try on your own first!)
# ============================================

print("\n" + "=" * 40)
print("SOLUTIONS")
print("=" * 40)

# --- Exercise 1 ---
print("\n--- Solution 1 ---")
name = "Alice"
age = 25
color = "blue"
print(f"My name is {name}, I'm {age}, and I love {color}.")

# --- Exercise 2 ---
print("\n--- Solution 2 ---")
number = 7
if number % 2 == 0:
    print(f"{number} is even")
else:
    print(f"{number} is odd")

# --- Exercise 3 ---
print("\n--- Solution 3 ---")
numbers = [4, 8, 15, 16, 23, 42]
total = 0
for n in numbers:
    total = total + n
print(f"Sum: {total}")

# --- Exercise 4 ---
print("\n--- Solution 4 ---")
for i in range(1, 21):
    if i % 3 == 0 and i % 5 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)

# --- Exercise 5 ---
print("\n--- Solution 5 ---")
def max_of_three(a, b, c):
    if a >= b and a >= c:
        return a
    elif b >= a and b >= c:
        return b
    else:
        return c

print(f"max_of_three(3, 9, 5) = {max_of_three(3, 9, 5)}")
print(f"max_of_three(12, 4, 8) = {max_of_three(12, 4, 8)}")
