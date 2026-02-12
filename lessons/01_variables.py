# ============================================
# LESSON 1: Variables and Data Types
# ============================================
# A variable is like a labeled box that holds a value.
# You create one by picking a name and using = to assign a value.

# --- Strings (text) ---
# Strings are text wrapped in quotes (single or double).
name = "Alice"
greeting = 'Hello'
print(greeting, name)  # Output: Hello Alice

# --- Numbers ---
# Integers are whole numbers. Floats have decimal points.
age = 25          # integer
height = 5.7      # float
print("Age:", age)
print("Height:", height)

# --- Math with numbers ---
a = 10
b = 3
print(a + b)   # Addition: 13
print(a - b)   # Subtraction: 7
print(a * b)   # Multiplication: 30
print(a / b)   # Division: 3.333...
print(a // b)  # Floor division: 3 (rounds down)
print(a % b)   # Modulo/remainder: 1
print(a ** b)  # Exponent: 1000 (10 to the power of 3)

# --- Booleans (True / False) ---
is_sunny = True
is_raining = False
print("Is it sunny?", is_sunny)

# --- Checking types ---
# Use type() to see what kind of data a variable holds.
print(type(name))       # <class 'str'>
print(type(age))        # <class 'int'>
print(type(height))     # <class 'float'>
print(type(is_sunny))   # <class 'bool'>

# --- String operations ---
first = "Hello"
last = "World"
combined = first + " " + last  # Concatenation (joining strings)
print(combined)                # Hello World
print(len(combined))           # 11 (length of the string)

# --- Converting between types ---
num_str = "42"
num = int(num_str)       # Convert string to integer
print(num + 8)           # 50

pi_str = "3.14"
pi = float(pi_str)       # Convert string to float
print(pi)                # 3.14

back_to_str = str(100)   # Convert number to string
print("Score: " + back_to_str)

# --- Getting input from the user ---
# Uncomment the lines below to try it interactively:
# user_name = input("What is your name? ")
# print("Nice to meet you, " + user_name + "!")

# ============================================
# KEY TAKEAWAYS:
# 1. Variables store data using = (assignment)
# 2. Main types: str, int, float, bool
# 3. Use print() to display output
# 4. Use type() to check a variable's type
# 5. Convert between types with int(), float(), str()
# ============================================
