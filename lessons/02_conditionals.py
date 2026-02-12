# ============================================
# LESSON 2: Conditionals (Making Decisions)
# ============================================
# Programs often need to make decisions based on conditions.
# Python uses if, elif (else if), and else for this.

# --- Basic if statement ---
temperature = 35

if temperature > 30:
    print("It's hot outside!")
# The indented line only runs if the condition is True.

# --- if / else ---
age = 16

if age >= 18:
    print("You can vote!")
else:
    print("You're too young to vote.")

# --- if / elif / else ---
# Use elif to check multiple conditions in order.
score = 75

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
elif score >= 60:
    grade = "D"
else:
    grade = "F"

print(f"Score: {score}, Grade: {grade}")
# f-strings (f"...") let you put variables inside {} in a string.

# --- Comparison operators ---
# ==   equal to
# !=   not equal to
# >    greater than
# <    less than
# >=   greater than or equal to
# <=   less than or equal to

x = 10
print(x == 10)   # True
print(x != 5)    # True
print(x > 20)    # False

# --- Combining conditions with and / or / not ---
age = 25
has_license = True

if age >= 16 and has_license:
    print("You can drive!")

is_weekend = True
is_holiday = False

if is_weekend or is_holiday:
    print("No work today!")

is_raining = False

if not is_raining:
    print("No umbrella needed.")

# --- Nested if statements ---
has_ticket = True
age = 15

if has_ticket:
    if age >= 13:
        print("Enjoy the movie!")
    else:
        print("This movie is not for kids.")
else:
    print("You need a ticket first.")

# --- Checking strings ---
color = "red"

if color == "red":
    print("Stop!")
elif color == "yellow":
    print("Slow down.")
elif color == "green":
    print("Go!")

# --- Truthy and Falsy values ---
# Empty strings, 0, and None are considered "falsy"
name = ""
if name:
    print(f"Hello, {name}!")
else:
    print("Name is empty!")

# ============================================
# KEY TAKEAWAYS:
# 1. if checks a condition; indented code runs if True
# 2. else runs when the if condition is False
# 3. elif lets you check additional conditions
# 4. Combine conditions with and, or, not
# 5. Comparison operators: ==, !=, >, <, >=, <=
# ============================================
